import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the optional Manus admin dashboard auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Telegram identity is stored only on the server and never shown to peers by default. */
export const telegramUsers = mysqlTable(
  "telegram_users",
  {
    id: int("id").autoincrement().primaryKey(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull().unique(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("firstName", { length: 255 }),
    flowState: varchar("flowState", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  table => [index("telegram_users_last_seen_idx").on(table.lastSeenAt)]
);

export const chats = mysqlTable(
  "anonymous_chats",
  {
    id: int("id").autoincrement().primaryKey(),
    status: mysqlEnum("status", ["waiting", "active", "closed"]).default("waiting").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("anonymous_chats_status_idx").on(table.status)]
);

export const chatMembers = mysqlTable(
  "anonymous_chat_members",
  {
    id: int("id").autoincrement().primaryKey(),
    chatId: int("chatId").notNull(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    leftAt: timestamp("leftAt"),
  },
  table => [
    uniqueIndex("chat_members_chat_user_unique").on(table.chatId, table.telegramUserId),
    index("chat_members_user_idx").on(table.telegramUserId),
  ]
);

export const messages = mysqlTable(
  "anonymous_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    chatId: int("chatId").notNull(),
    senderTelegramUserId: varchar("senderTelegramUserId", { length: 64 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("messages_chat_created_idx").on(table.chatId, table.createdAt)]
);

/** User-specific label. The other participant never sees this label. */
export const chatNames = mysqlTable(
  "anonymous_chat_names",
  {
    id: int("id").autoincrement().primaryKey(),
    chatId: int("chatId").notNull(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("chat_names_chat_user_unique").on(table.chatId, table.telegramUserId)]
);

/** One-sided contact reveal: fromUser explicitly shares their own username with toUser. */
export const contactReveals = mysqlTable(
  "anonymous_contact_reveals",
  {
    id: int("id").autoincrement().primaryKey(),
    chatId: int("chatId").notNull(),
    fromTelegramUserId: varchar("fromTelegramUserId", { length: 64 }).notNull(),
    toTelegramUserId: varchar("toTelegramUserId", { length: 64 }).notNull(),
    revealedAt: timestamp("revealedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("contact_reveals_chat_from_to_unique").on(
      table.chatId,
      table.fromTelegramUserId,
      table.toTelegramUserId
    ),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type ChatMember = typeof chatMembers.$inferSelect;
export type ChatMessage = typeof messages.$inferSelect;
export type ChatName = typeof chatNames.$inferSelect;
export type ContactReveal = typeof contactReveals.$inferSelect;
