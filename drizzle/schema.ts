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

export const telegramUsers = mysqlTable(
  "telegram_users",
  {
    id: int("id").autoincrement().primaryKey(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull().unique(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("firstName", { length: 255 }),
    displayName: varchar("displayName", { length: 120 }),
    iconKey: varchar("iconKey", { length: 40 }).default("message-circle").notNull(),
    accentColor: varchar("accentColor", { length: 20 }).default("#6d5dfc").notNull(),
    flowState: varchar("flowState", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  table => [index("telegram_users_last_seen_idx").on(table.lastSeenAt)]
);

export const telegramChatMessages = mysqlTable(
  "telegram_chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    telegramChatId: varchar("telegramChatId", { length: 64 }).notNull(),
    telegramMessageId: int("telegramMessageId").notNull(),
    direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("telegram_chat_message_unique").on(table.telegramChatId, table.telegramMessageId)]
);

export const userSettings = mysqlTable("telegram_user_settings", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 64 }).notNull().unique(),
  fontScale: varchar("fontScale", { length: 20 }).default("medium").notNull(),
  chatBackground: varchar("chatBackground", { length: 20 }).default("paper").notNull(),
  messageColor: varchar("messageColor", { length: 20 }).default("#172033").notNull(),
  theme: mysqlEnum("theme", ["light", "dark"]).default("light").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userTags = mysqlTable(
  "telegram_user_tags",
  {
    id: int("id").autoincrement().primaryKey(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull(),
    label: varchar("label", { length: 48 }).notNull(),
    normalizedLabel: varchar("normalizedLabel", { length: 48 }).notNull(),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("user_tags_user_label_unique").on(table.telegramUserId, table.normalizedLabel),
    index("user_tags_normalized_idx").on(table.normalizedLabel),
  ]
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
    editedAt: timestamp("editedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("messages_chat_created_idx").on(table.chatId, table.createdAt)]
);

export const chatNames = mysqlTable(
  "anonymous_chat_names",
  {
    id: int("id").autoincrement().primaryKey(),
    chatId: int("chatId").notNull(),
    telegramUserId: varchar("telegramUserId", { length: 64 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    iconKey: varchar("iconKey", { length: 40 }).default("message-circle").notNull(),
    color: varchar("color", { length: 20 }).default("#6d5dfc").notNull(),
    deletedAt: timestamp("deletedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("chat_names_chat_user_unique").on(table.chatId, table.telegramUserId)]
);

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
export type TelegramChatMessage = typeof telegramChatMessages.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type ChatMember = typeof chatMembers.$inferSelect;
export type ChatMessage = typeof messages.$inferSelect;
export type ChatName = typeof chatNames.$inferSelect;
export type UserTag = typeof userTags.$inferSelect;
export type UserSetting = typeof userSettings.$inferSelect;
export type ContactReveal = typeof contactReveals.$inferSelect;
