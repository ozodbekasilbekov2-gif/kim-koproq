import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
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
  userSettings,
  userTags,
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
  displayName?: string;
  iconKey?: string;
  accentColor?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = { lastSeenAt: new Date() };
  if (input.username !== undefined) updateSet.username = input.username ?? null;
  if (input.firstName !== undefined) updateSet.firstName = input.firstName ?? null;
  if (input.displayName !== undefined) updateSet.displayName = input.displayName ?? null;
  if (input.iconKey !== undefined) updateSet.iconKey = input.iconKey;
  if (input.accentColor !== undefined) updateSet.accentColor = input.accentColor;
  await db
    .insert(telegramUsers)
    .values({
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      displayName: input.displayName ?? null,
      iconKey: input.iconKey ?? "message-circle",
      accentColor: input.accentColor ?? "#6d5dfc",
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getTelegramUser(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramUserId, telegramUserId)).limit(1);
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

export async function getUserSettings(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userSettings).where(eq(userSettings.telegramUserId, telegramUserId)).limit(1);
  if (result[0]) return result[0];
  await db.insert(userSettings).values({ telegramUserId });
  const created = await db.select().from(userSettings).where(eq(userSettings.telegramUserId, telegramUserId)).limit(1);
  return created[0];
}

export async function updateUserSettings(telegramUserId: string, input: {
  fontScale?: string;
  chatBackground?: string;
  messageColor?: string;
  theme?: "light" | "dark";
}) {
  const db = await getDb();
  if (!db) return;
  await getUserSettings(telegramUserId);
  await db.update(userSettings).set({ ...input, updatedAt: new Date() }).where(eq(userSettings.telegramUserId, telegramUserId));
}

export async function updateTelegramProfile(telegramUserId: string, input: {
  displayName?: string;
  iconKey?: string;
  accentColor?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(telegramUsers).set(input).where(eq(telegramUsers.telegramUserId, telegramUserId));
}

export async function getUserTags(telegramUserId: string, includeDeleted = false) {
  const db = await getDb();
  if (!db) return [];
  const where = includeDeleted
    ? eq(userTags.telegramUserId, telegramUserId)
    : and(eq(userTags.telegramUserId, telegramUserId), isNull(userTags.deletedAt));
  return db.select().from(userTags).where(where).orderBy(userTags.label);
}

export async function saveUserTag(telegramUserId: string, label: string) {
  const db = await getDb();
  if (!db) return;
  const clean = label.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 48);
  const normalized = clean.toLocaleLowerCase("ru-RU");
  if (!normalized) return;
  await db
    .insert(userTags)
    .values({ telegramUserId, label: clean, normalizedLabel: normalized, deletedAt: null })
    .onDuplicateKeyUpdate({ set: { label: clean, deletedAt: null, updatedAt: new Date() } });
}

export async function trashUserTag(telegramUserId: string, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userTags).set({ deletedAt: new Date() }).where(and(eq(userTags.id, tagId), eq(userTags.telegramUserId, telegramUserId)));
}

export async function restoreUserTag(telegramUserId: string, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userTags).set({ deletedAt: null }).where(and(eq(userTags.id, tagId), eq(userTags.telegramUserId, telegramUserId)));
}

export async function hardDeleteUserTag(telegramUserId: string, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userTags).where(and(eq(userTags.id, tagId), eq(userTags.telegramUserId, telegramUserId)));
}

export async function getActiveChatForUser(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ chat: chats, member: chatMembers })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(and(eq(chatMembers.telegramUserId, telegramUserId), isNull(chatMembers.leftAt), eq(chats.status, "active")))
    .limit(1);
  return result[0]?.chat;
}

export async function getOtherMember(chatId: number, telegramUserId: string, includeInactive = false) {
  const db = await getDb();
  if (!db) return undefined;
  const membershipRows = includeInactive
    ? await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId))
    : await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), isNull(chatMembers.leftAt)));
  const other = membershipRows.find(member => member.telegramUserId !== telegramUserId);
  return other ? getTelegramUser(other.telegramUserId) : undefined;
}

export async function createChatBetween(firstTelegramUserId: string, secondTelegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db
    .select({ chat: chats })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(and(eq(chatMembers.telegramUserId, firstTelegramUserId), eq(chats.status, "active")))
    .limit(20);
  for (const row of existing) {
    const members = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, row.chat.id), isNull(chatMembers.leftAt)));
    if (members.some(member => member.telegramUserId === secondTelegramUserId)) return row.chat;
  }
  const created = await db.insert(chats).values({ status: "active" });
  const chatId = Number(created[0].insertId);
  await db.insert(chatMembers).values([
    { chatId, telegramUserId: firstTelegramUserId },
    { chatId, telegramUserId: secondTelegramUserId },
  ]);
  return { id: chatId, status: "active" as const };
}

export async function findTagMatch(telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const ownTags = await getUserTags(telegramUserId);
  if (!ownTags.length) return undefined;
  const candidates = await db
    .select({ user: telegramUsers, tag: userTags })
    .from(userTags)
    .innerJoin(telegramUsers, eq(telegramUsers.telegramUserId, userTags.telegramUserId))
    .where(and(inArray(userTags.normalizedLabel, ownTags.map(tag => tag.normalizedLabel)), isNull(userTags.deletedAt), ne(userTags.telegramUserId, telegramUserId)))
    .limit(100);
  for (const candidate of candidates) {
    if (!(await getActiveChatForUser(candidate.user.telegramUserId))) return candidate.user;
  }
  return undefined;
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
  if (!db) return undefined;
  const result = await db.insert(messages).values({ chatId, senderTelegramUserId, body });
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
  const created = await db.select().from(messages).where(eq(messages.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function getChatMessages(chatId: number, limit = 100, includeDeleted = false): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const where = includeDeleted ? eq(messages.chatId, chatId) : and(eq(messages.chatId, chatId), isNull(messages.deletedAt));
  const result = await db.select().from(messages).where(where).orderBy(desc(messages.createdAt)).limit(limit);
  return result.reverse();
}

export async function getMessage(messageId: number, chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const membership = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.telegramUserId, telegramUserId))).limit(1);
  if (!membership[0]) return undefined;
  const result = await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.chatId, chatId))).limit(1);
  return result[0];
}

export async function editMessage(messageId: number, chatId: number, telegramUserId: string, body: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.update(messages).set({ body, editedAt: new Date(), deletedAt: null }).where(and(eq(messages.id, messageId), eq(messages.chatId, chatId), eq(messages.senderTelegramUserId, telegramUserId)));
  if (!result) return undefined;
  return getMessage(messageId, chatId, telegramUserId);
}

export async function trashMessage(messageId: number, chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ deletedAt: new Date() }).where(and(eq(messages.id, messageId), eq(messages.chatId, chatId), eq(messages.senderTelegramUserId, telegramUserId)));
}

export async function restoreMessage(messageId: number, chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ deletedAt: null }).where(and(eq(messages.id, messageId), eq(messages.chatId, chatId), eq(messages.senderTelegramUserId, telegramUserId)));
}

export async function hardDeleteMessage(messageId: number, chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.chatId, chatId), eq(messages.senderTelegramUserId, telegramUserId)));
}

export async function getHistoryForUser(telegramUserId: string, includeDeleted = false) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select({ chat: chats, member: chatMembers }).from(chatMembers).innerJoin(chats, eq(chats.id, chatMembers.chatId)).where(eq(chatMembers.telegramUserId, telegramUserId)).orderBy(desc(chats.updatedAt));
  const result = [];
  for (const row of memberships) {
    const names = await db.select().from(chatNames).where(and(eq(chatNames.chatId, row.chat.id), eq(chatNames.telegramUserId, telegramUserId))).limit(1);
    const chatName = names[0];
    if (!includeDeleted && chatName?.deletedAt) continue;
    const other = await getOtherMember(row.chat.id, telegramUserId, true);
    const tags = other ? await getSharedTags(telegramUserId, other.telegramUserId) : [];
    result.push({ chat: row.chat, name: chatName?.name ?? `Чат #${row.chat.id}`, iconKey: chatName?.iconKey ?? "message-circle", color: chatName?.color ?? "#6d5dfc", deletedAt: chatName?.deletedAt ?? null, other, sharedTags: tags });
  }
  return result;
}

export async function setChatName(chatId: number, telegramUserId: string, name: string, iconKey?: string, color?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatNames).values({ chatId, telegramUserId, name: name.slice(0, 80), iconKey: iconKey ?? "message-circle", color: color ?? "#6d5dfc", deletedAt: null }).onDuplicateKeyUpdate({ set: { name: name.slice(0, 80), ...(iconKey ? { iconKey } : {}), ...(color ? { color } : {}), deletedAt: null, updatedAt: new Date() } });
}

export async function trashChatForUser(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(chatNames).where(and(eq(chatNames.chatId, chatId), eq(chatNames.telegramUserId, telegramUserId))).limit(1);
  if (existing[0]) {
    await db.update(chatNames).set({ deletedAt: new Date() }).where(eq(chatNames.id, existing[0].id));
  } else {
    await db.insert(chatNames).values({ chatId, telegramUserId, name: `Чат #${chatId}`, deletedAt: new Date() });
  }
}

export async function restoreChatForUser(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatNames).set({ deletedAt: null }).where(and(eq(chatNames.chatId, chatId), eq(chatNames.telegramUserId, telegramUserId)));
}

export async function hardDeleteChatForUser(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatNames).where(and(eq(chatNames.chatId, chatId), eq(chatNames.telegramUserId, telegramUserId)));
  await db.update(chatMembers).set({ leftAt: new Date() }).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.telegramUserId, telegramUserId)));
}

export async function getSharedTags(firstTelegramUserId: string, secondTelegramUserId: string) {
  const db = await getDb();
  if (!db) return [];
  const first = await getUserTags(firstTelegramUserId);
  const second = await getUserTags(secondTelegramUserId);
  const secondSet = new Set(second.map(tag => tag.normalizedLabel));
  return first.filter(tag => secondSet.has(tag.normalizedLabel)).map(tag => tag.label);
}

export async function removeChatForUser(chatId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatMembers).set({ leftAt: new Date() }).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.telegramUserId, telegramUserId)));
  await db.update(chats).set({ status: "closed", updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function revealContact(chatId: number, fromTelegramUserId: string, toTelegramUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const owner = await getTelegramUser(fromTelegramUserId);
  await db.insert(contactReveals).values({ chatId, fromTelegramUserId, toTelegramUserId }).onDuplicateKeyUpdate({ set: { revealedAt: new Date() } });
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
