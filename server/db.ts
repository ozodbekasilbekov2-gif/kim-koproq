import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ChatMessage,
  InsertUser,
  chatMembers,
  chatNames,
  chats,
  contactReveals,
  messages,
  telegramUsers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertTelegramUser(input: {
  telegramUserId: string;
  username?: string;
  firstName?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(telegramUsers)
    .values({
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastSeenAt: new Date(),
      },
    });
}

export async function getTelegramUser(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramUserId, telegramUserId))
    .limit(1);
  return result[0];
}

export async function setFlowState(telegramUserId: string, flowState: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(telegramUsers).set({ flowState }).where(eq(telegramUsers.telegramUserId, telegramUserId));
}

export async function getFlowState(telegramUserId: string) {
  const user = await getTelegramUser(telegramUserId);
  return user?.flowState ?? null;
}

export async function getActiveChatForUser(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ chat: chats, member: chatMembers })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(
      and(
        eq(chatMembers.telegramUserId, telegramUserId),
        isNull(chatMembers.leftAt),
        eq(chats.status, "active")
      )
    )
    .limit(1);
  return result[0]?.chat;
}

export async function getOtherMember(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(chatMembers)
    .where(
      and(
        eq(chatMembers.chatId, chatId),
        isNull(chatMembers.leftAt)
      )
    );
  const other = result.find(member => member.telegramUserId !== telegramUserId);
  return other ? getTelegramUser(other.telegramUserId) : undefined;
}

export async function createOrJoinChat(telegramUserId: string) {
  const db = await getDb();
  if (!db) return { status: "unavailable" as const };

  const existing = await getActiveChatForUser(telegramUserId);
  if (existing) return { status: "active" as const, chat: existing };

  const waiting = await db
    .select({ chat: chats, member: chatMembers })
    .from(chats)
    .innerJoin(chatMembers, eq(chats.id, chatMembers.chatId))
    .where(and(eq(chats.status, "waiting"), isNull(chatMembers.leftAt)))
    .limit(1);

  if (waiting[0]) {
    const chat = waiting[0].chat;
    await db.insert(chatMembers).values({ chatId: chat.id, telegramUserId });
    await db.update(chats).set({ status: "active", updatedAt: new Date() }).where(eq(chats.id, chat.id));
    return { status: "active" as const, chat };
  }

  const created = await db.insert(chats).values({ status: "waiting" });
  const chatId = Number(created[0].insertId);
  await db.insert(chatMembers).values({ chatId, telegramUserId });
  return { status: "waiting" as const, chat: { id: chatId, status: "waiting" as const } };
}

export async function saveMessage(chatId: number, senderTelegramUserId: string, body: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(messages).values({ chatId, senderTelegramUserId, body });
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function getChatMessages(chatId: number, limit = 100): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return result.reverse();
}

export async function getHistoryForUser(telegramUserId: string) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db
    .select({ chat: chats, member: chatMembers })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(eq(chatMembers.telegramUserId, telegramUserId))
    .orderBy(desc(chats.updatedAt));

  const result = [];
  for (const row of memberships) {
    const names = await db
      .select()
      .from(chatNames)
      .where(and(eq(chatNames.chatId, row.chat.id), eq(chatNames.telegramUserId, telegramUserId)))
      .limit(1);
    const other = await getOtherMember(row.chat.id, telegramUserId);
    result.push({ chat: row.chat, name: names[0]?.name ?? `Чат #${row.chat.id}`, other });
  }
  return result;
}

export async function setChatName(chatId: number, telegramUserId: string, name: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(chatNames)
    .values({ chatId, telegramUserId, name })
    .onDuplicateKeyUpdate({ set: { name, updatedAt: new Date() } });
}

export async function removeChatForUser(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(chatMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.telegramUserId, telegramUserId)));
  await db.update(chats).set({ status: "closed", updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function revealContact(chatId: number, fromTelegramUserId: string, toTelegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const owner = await getTelegramUser(fromTelegramUserId);
  await db
    .insert(contactReveals)
    .values({ chatId, fromTelegramUserId, toTelegramUserId })
    .onDuplicateKeyUpdate({ set: { revealedAt: new Date() } });
  return owner;
}

export async function countTelegramUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: telegramUsers.id }).from(telegramUsers);
  return result.length;
}

export async function countActiveChats() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: chats.id }).from(chats).where(eq(chats.status, "active"));
  return result.length;
}
