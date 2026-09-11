import type { Express, Request, Response } from "express";
import {
  createChatBetween,
  createOrJoinChat,
  editMessage,
  findTagMatch,
  getChatMessages,
  getHistoryForUser,
  getOtherMember,
  getTelegramUser,
  getUserSettings,
  getUserTags,
  hardDeleteChatForUser,
  hardDeleteMessage,
  hardDeleteUserTag,
  restoreChatForUser,
  restoreMessage,
  restoreUserTag,
  saveMessage,
  saveUserTag,
  setChatName,
  trashChatForUser,
  trashMessage,
  trashUserTag,
  updateTelegramProfile,
  updateUserSettings,
} from "./db";
import { authenticateMiniAppRequest, type MiniAppTelegramUser } from "./miniappAuth";
import { sendTelegramText } from "./telegram";

const ICON_KEYS = new Set([
  "message-circle",
  "heart-handshake",
  "book-open",
  "music-2",
  "palette",
  "briefcase-business",
  "graduation-cap",
  "camera",
  "leaf",
  "sparkles",
]);
const COLORS = new Set(["#6d5dfc", "#e35d6a", "#1da89b", "#e59b42", "#4f86f7", "#9b6de3"]);
const FONT_SCALES = new Set(["small", "medium", "large"]);
const BACKGROUNDS = new Set(["paper", "mist", "night", "peach"]);

function userId(res: Response) {
  return String((res.locals.telegramUser as MiniAppTelegramUser).id);
}

function bodyString(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function serializeUser(user: Awaited<ReturnType<typeof getTelegramUser>>) {
  return user
    ? {
        displayName: user.displayName || user.firstName || "Аноним",
        iconKey: user.iconKey,
        accentColor: user.accentColor,
      }
    : { displayName: "Аноним", iconKey: "message-circle", accentColor: "#6d5dfc" };
}

function serializeChat(item: Awaited<ReturnType<typeof getHistoryForUser>>[number]) {
  return {
    id: item.chat.id,
    name: item.name,
    iconKey: item.iconKey,
    color: item.color,
    status: item.chat.status,
    deletedAt: item.deletedAt,
    other: serializeUser(item.other),
    sharedTags: item.sharedTags,
  };
}

async function getAuthorizedChat(telegramId: string, chatId: number) {
  const active = await getHistoryForUser(telegramId, true);
  return active.find(item => item.chat.id === chatId);
}

async function sendPeerNotification(chatId: number, telegramId: string, body: string) {
  const other = await getOtherMember(chatId, telegramId);
  if (other) await sendTelegramText(Number(other.telegramUserId), `💬 Собеседник\n${body}`);
}

export function registerMiniAppRoutes(app: Express) {
  app.use("/api/miniapp", authenticateMiniAppRequest);

  app.get("/api/miniapp/state", async (_req, res) => {
    const telegramId = userId(res);
    const profile = await getTelegramUser(telegramId);
    const settings = await getUserSettings(telegramId);
    const tags = await getUserTags(telegramId);
    const deletedTags = await getUserTags(telegramId, true);
    const chats = await getHistoryForUser(telegramId);
    const deletedChats = await getHistoryForUser(telegramId, true);
    res.json({
      ok: true,
      profile: serializeUser(profile),
      settings,
      tags,
      deletedTags: deletedTags.filter(tag => tag.deletedAt),
      chats: chats.map(serializeChat),
      deletedChats: deletedChats.filter(chat => chat.deletedAt).map(serializeChat),
    });
  });

  app.get("/api/miniapp/chats/:chatId", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    const chat = await getAuthorizedChat(telegramId, chatId);
    if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
    const messages = await getChatMessages(chatId, 100, req.query.trash === "true");
    res.json({ ok: true, chat: serializeChat(chat), messages });
  });

  app.post("/api/miniapp/chats/match", async (_req, res) => {
    const telegramId = userId(res);
    const candidate = await findTagMatch(telegramId);
    if (candidate) {
      const chat = await createChatBetween(telegramId, candidate.telegramUserId);
      if (chat) {
        await sendTelegramText(Number(candidate.telegramUserId), "Собеседник найден по общим тегам. Откройте Mini App или продолжайте в Telegram.");
        await sendTelegramText(Number(telegramId), "Собеседник найден по общим тегам. Можете начинать разговор.");
        const history = await getHistoryForUser(telegramId);
        const selected = history.find(item => item.chat.id === chat.id);
        return res.json({ ok: true, matched: true, chat: selected ? serializeChat(selected) : { id: chat.id } });
      }
    }
    const queued = await createOrJoinChat(telegramId);
    if (queued.status === "unavailable") return res.status(503).json({ ok: false, error: "Database unavailable" });
    const history = await getHistoryForUser(telegramId);
    const selected = history.find(item => item.chat.id === queued.chat.id);
    res.json({ ok: true, matched: queued.status === "active", chat: selected ? serializeChat(selected) : { id: queued.chat.id, status: queued.status } });
  });

  app.post("/api/miniapp/chats/:chatId/messages", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    const chat = await getAuthorizedChat(telegramId, chatId);
    const body = bodyString(req.body?.body);
    if (!chat || !body) return res.status(400).json({ ok: false, error: "Chat or message is invalid" });
    const message = await saveMessage(chatId, telegramId, body);
    await sendPeerNotification(chatId, telegramId, body);
    res.json({ ok: true, message });
  });

  app.patch("/api/miniapp/chats/:chatId/messages/:messageId", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    const messageId = Number(req.params.messageId);
    const body = bodyString(req.body?.body);
    const chat = await getAuthorizedChat(telegramId, chatId);
    if (!chat || !body) return res.status(400).json({ ok: false, error: "Message is invalid" });
    const message = await editMessage(messageId, chatId, telegramId, body);
    if (!message) return res.status(404).json({ ok: false, error: "Message not found" });
    res.json({ ok: true, message });
  });

  app.delete("/api/miniapp/chats/:chatId/messages/:messageId", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    const messageId = Number(req.params.messageId);
    const chat = await getAuthorizedChat(telegramId, chatId);
    if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
    if (req.query.permanent === "true") await hardDeleteMessage(messageId, chatId, telegramId);
    else await trashMessage(messageId, chatId, telegramId);
    res.json({ ok: true });
  });

  app.post("/api/miniapp/chats/:chatId/messages/:messageId/restore", async (req, res) => {
    const telegramId = userId(res);
    await restoreMessage(Number(req.params.messageId), Number(req.params.chatId), telegramId);
    res.json({ ok: true });
  });

  app.post("/api/miniapp/chats/:chatId/messages/:messageId/permanent-delete", async (req, res) => {
    const telegramId = userId(res);
    await hardDeleteMessage(Number(req.params.messageId), Number(req.params.chatId), telegramId);
    res.json({ ok: true });
  });

  app.patch("/api/miniapp/chats/:chatId", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    const chat = await getAuthorizedChat(telegramId, chatId);
    if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
    const name = bodyString(req.body?.name, 80) || chat.name;
    const iconKey = ICON_KEYS.has(req.body?.iconKey) ? req.body.iconKey : chat.iconKey;
    const color = COLORS.has(req.body?.color) ? req.body.color : chat.color;
    await setChatName(chatId, telegramId, name, iconKey, color);
    res.json({ ok: true });
  });

  app.delete("/api/miniapp/chats/:chatId", async (req, res) => {
    const telegramId = userId(res);
    const chatId = Number(req.params.chatId);
    if (!(await getAuthorizedChat(telegramId, chatId))) return res.status(404).json({ ok: false, error: "Chat not found" });
    if (req.query.permanent === "true") await hardDeleteChatForUser(chatId, telegramId);
    else await trashChatForUser(chatId, telegramId);
    res.json({ ok: true });
  });

  app.post("/api/miniapp/chats/:chatId/restore", async (req, res) => {
    await restoreChatForUser(Number(req.params.chatId), userId(res));
    res.json({ ok: true });
  });

  app.post("/api/miniapp/tags", async (req, res) => {
    const label = bodyString(req.body?.label, 48);
    if (!label) return res.status(400).json({ ok: false, error: "Tag is empty" });
    await saveUserTag(userId(res), label);
    res.json({ ok: true });
  });

  app.delete("/api/miniapp/tags/:tagId", async (req, res) => {
    if (req.query.permanent === "true") await hardDeleteUserTag(userId(res), Number(req.params.tagId));
    else await trashUserTag(userId(res), Number(req.params.tagId));
    res.json({ ok: true });
  });

  app.post("/api/miniapp/tags/:tagId/restore", async (req, res) => {
    await restoreUserTag(userId(res), Number(req.params.tagId));
    res.json({ ok: true });
  });

  app.patch("/api/miniapp/profile", async (req, res) => {
    const input = {
      displayName: bodyString(req.body?.displayName, 120),
      iconKey: ICON_KEYS.has(req.body?.iconKey) ? req.body.iconKey : undefined,
      accentColor: COLORS.has(req.body?.accentColor) ? req.body.accentColor : undefined,
    };
    await updateTelegramProfile(userId(res), input);
    res.json({ ok: true });
  });

  app.patch("/api/miniapp/settings", async (req, res) => {
    const input = {
      fontScale: FONT_SCALES.has(req.body?.fontScale) ? req.body.fontScale : undefined,
      chatBackground: BACKGROUNDS.has(req.body?.chatBackground) ? req.body.chatBackground : undefined,
      messageColor: COLORS.has(req.body?.messageColor) ? req.body.messageColor : undefined,
      theme: req.body?.theme === "dark" || req.body?.theme === "light" ? req.body.theme : undefined,
    } as const;
    await updateUserSettings(userId(res), input);
    res.json({ ok: true });
  });
}
