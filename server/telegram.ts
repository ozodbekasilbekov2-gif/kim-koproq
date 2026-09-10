import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import {
  createOrJoinChat,
  getActiveChatForUser,
  getChatMessages,
  getFlowState,
  getHistoryForUser,
  getOtherMember,
  getTelegramUser,
  removeChatForUser,
  revealContact,
  saveMessage,
  setChatName,
  setFlowState,
  upsertTelegramUser,
} from "./db";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
};

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

type ReplyKeyboardMarkup = {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard: true;
  is_persistent?: boolean;
};

const MAIN_MENU: ReplyKeyboardMarkup = {
  keyboard: [[{ text: "💬 Пообщаться" }, { text: "🗂 История чатов" }]],
  resize_keyboard: true,
  is_persistent: true,
};

const CHAT_MENU: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: "🤝 Представить контакты" }, { text: "⏭ Новый собеседник" }],
    [{ text: "🗂 История чатов" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function telegramUserId(user: TelegramUser) {
  return String(user.id);
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").slice(0, 4000);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

export function isTelegramWebhookAuthorized(
  headers: Record<string, string | string[] | undefined>,
  expectedSecret: string
) {
  if (!expectedSecret) return true;
  const received = headers["x-telegram-bot-api-secret-token"];
  return received === expectedSecret;
}

async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  if (!ENV.telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description ?? `Telegram API ${method} failed`);
  return body.result as T;
}

async function sendMessage(
  chatId: number,
  text: string,
  options: { replyMarkup?: ReplyKeyboardMarkup | InlineKeyboardMarkup; parseMode?: "HTML" } = {}
) {
  return telegramApi<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    reply_markup: options.replyMarkup,
    disable_web_page_preview: true,
  });
}

async function answerCallbackQuery(id: string, text?: string) {
  await telegramApi("answerCallbackQuery", { callback_query_id: id, text, show_alert: false });
}

async function deleteMessage(chatId: number, messageId: number) {
  try {
    await telegramApi("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // Deleting is best-effort: Telegram restricts deletion by message age and ownership.
  }
}

async function showMainMenu(chatId: number, greeting = false) {
  const text = greeting
    ? "<b>Анонимные чаты</b>\n\nЗдесь можно спокойно познакомиться и общаться без раскрытия имени. Ваш Telegram ID скрыт от собеседника.\n\nКогда появится доверие, вы сможете отправить контакт только по своему желанию."
    : "Главное меню. Выберите действие ниже.";
  await sendMessage(chatId, text, { replyMarkup: MAIN_MENU, parseMode: "HTML" });
}

async function showHistory(chatId: number, telegramId: string) {
  const history = await getHistoryForUser(telegramId);
  if (history.length === 0) {
    await sendMessage(chatId, "История пока пуста. Нажмите «Пообщаться», чтобы найти первого собеседника.", {
      replyMarkup: MAIN_MENU,
    });
    return;
  }

  const rows = history.slice(0, 30).map(item => [
    {
      text: `${item.chat.status === "active" ? "●" : "○"} ${item.name}`,
      callback_data: `chat:${item.chat.id}`,
    },
  ]);
  await sendMessage(chatId, "<b>История чатов</b>\n\nВыберите чат. Названия видны только вам.", {
    replyMarkup: { inline_keyboard: rows },
    parseMode: "HTML",
  });
}

async function showChatActions(chatId: number, telegramId: string, selectedChatId: number) {
  const history = await getHistoryForUser(telegramId);
  const selected = history.find(item => item.chat.id === selectedChatId);
  if (!selected) {
    await sendMessage(chatId, "Этот чат больше недоступен.", { replyMarkup: MAIN_MENU });
    return;
  }
  await sendMessage(chatId, `<b>${escapeHtml(selected.name)}</b>\nВыберите действие:`, {
    replyMarkup: {
      inline_keyboard: [
        [{ text: "💬 Пообщаться", callback_data: `chat-talk:${selectedChatId}` }],
        [
          { text: "✏️ Изменить", callback_data: `chat-rename:${selectedChatId}` },
          { text: "🗑 Удалить", callback_data: `chat-delete:${selectedChatId}` },
        ],
        [{ text: "‹ Назад", callback_data: "history" }],
      ],
    },
    parseMode: "HTML",
  });
}

async function showChatHistory(chatId: number, telegramId: string, selectedChatId: number) {
  const history = await getHistoryForUser(telegramId);
  const selected = history.find(item => item.chat.id === selectedChatId);
  if (!selected) {
    await showHistory(chatId, telegramId);
    return;
  }
  const items = await getChatMessages(selectedChatId);
  if (items.length === 0) {
    await sendMessage(chatId, `<b>${escapeHtml(selected.name)}</b>\n\nСообщений пока нет. Напишите первым.`, {
      replyMarkup: CHAT_MENU,
      parseMode: "HTML",
    });
    await setFlowState(telegramId, `chat:${selectedChatId}`);
    return;
  }

  const rendered = items
    .map(item => {
      const author = item.senderTelegramUserId === telegramId ? "Вы" : "Собеседник";
      return `<b>${author}</b>\n${escapeHtml(item.body)}`;
    })
    .join("\n\n");
  await sendMessage(chatId, `<b>${escapeHtml(selected.name)}</b>\n\n${rendered}`, {
    replyMarkup: CHAT_MENU,
    parseMode: "HTML",
  });
  await setFlowState(telegramId, `chat:${selectedChatId}`);
}

async function startSearching(chatId: number, telegramId: string) {
  const active = await getActiveChatForUser(telegramId);
  if (active) await removeChatForUser(active.id, telegramId);
  const result = await createOrJoinChat(telegramId);
  if (result.status === "unavailable") {
    await sendMessage(chatId, "Сервис временно недоступен. Попробуйте ещё раз через минуту.", {
      replyMarkup: MAIN_MENU,
    });
    return;
  }
  if (result.status === "waiting") {
    await setFlowState(telegramId, `waiting:${result.chat.id}`);
    await sendMessage(chatId, "Ищу собеседника… Как только кто-то подключится, можно будет писать.", {
      replyMarkup: MAIN_MENU,
    });
    return;
  }

  const other = await getOtherMember(result.chat.id, telegramId);
  await setFlowState(telegramId, `chat:${result.chat.id}`);
  await sendMessage(chatId, "Собеседник найден. Начните разговор — сообщение останется анонимным.", {
    replyMarkup: CHAT_MENU,
  });
  if (other) {
    await sendMessage(Number(other.telegramUserId), "Собеседник найден. Можете начинать разговор.", {
      replyMarkup: CHAT_MENU,
    });
    await setFlowState(other.telegramUserId, `chat:${result.chat.id}`);
  }
}

async function handleReveal(chatId: number, telegramId: string) {
  const active = await getActiveChatForUser(telegramId);
  if (!active) {
    await sendMessage(chatId, "Сначала откройте активный чат.", { replyMarkup: MAIN_MENU });
    return;
  }
  const other = await getOtherMember(active.id, telegramId);
  if (!other) {
    await sendMessage(chatId, "Собеседник больше недоступен.", { replyMarkup: MAIN_MENU });
    return;
  }
  const me = await getTelegramUser(telegramId);
  if (!me?.username) {
    await sendMessage(chatId, "У вас нет публичного username в Telegram, поэтому контакт нельзя передать через username. Добавьте его в настройках Telegram и повторите.", {
      replyMarkup: CHAT_MENU,
    });
    return;
  }
  await revealContact(active.id, telegramId, other.telegramUserId);
  await sendMessage(chatId, "Ваш username отправлен собеседнику. Это действие одностороннее — его контакт не раскрывается автоматически.", {
    replyMarkup: CHAT_MENU,
  });
  await sendMessage(
    Number(other.telegramUserId),
    `Собеседник решил представить контакт: <b>@${escapeHtml(me.username)}</b>\nВы можете открыть профиль и написать напрямую.`,
    { replyMarkup: CHAT_MENU, parseMode: "HTML" }
  );
}

async function handleTextMessage(message: TelegramMessage) {
  const user = message.from;
  if (!user || !message.text) return;
  const telegramId = telegramUserId(user);
  const chatId = message.chat.id;
  const text = normalizeText(message.text);

  await upsertTelegramUser({
    telegramUserId: telegramId,
    username: user.username,
    firstName: user.first_name,
  });

  if (text === "/start") {
    await setFlowState(telegramId, null);
    await showMainMenu(chatId, true);
    return;
  }
  if (text === "/privacy") {
    await sendMessage(chatId, "Анонимность: собеседник не получает ваш Telegram ID, имя или username, пока вы сами не нажмёте «Представить контакты». Сервер видит Telegram ID только для доставки сообщений. Не отправляйте пароли, адреса и другие чувствительные данные.", {
      replyMarkup: MAIN_MENU,
    });
    return;
  }
  if (text === "💬 Пообщаться" || text === "/chat") {
    await startSearching(chatId, telegramId);
    return;
  }
  if (text === "⏭ Новый собеседник") {
    await startSearching(chatId, telegramId);
    return;
  }
  if (text === "🗂 История чатов" || text === "/history") {
    await showHistory(chatId, telegramId);
    return;
  }
  if (text === "🤝 Представить контакты") {
    await handleReveal(chatId, telegramId);
    return;
  }

  const flowState = await getFlowState(telegramId);
  if (flowState?.startsWith("rename:")) {
    const selectedChatId = Number(flowState.slice("rename:".length));
    await setChatName(selectedChatId, telegramId, text.slice(0, 80));
    await setFlowState(telegramId, null);
    await sendMessage(chatId, `Название сохранено: <b>${escapeHtml(text.slice(0, 80))}</b>`, {
      replyMarkup: MAIN_MENU,
      parseMode: "HTML",
    });
    return;
  }
  if (flowState?.startsWith("delete:")) {
    const selectedChatId = Number(flowState.slice("delete:".length));
    const selected = (await getHistoryForUser(telegramId)).find(item => item.chat.id === selectedChatId);
    const expected = `удалить_${selected?.name ?? ""}`.toLowerCase();
    if (text.toLowerCase() !== expected) {
      await sendMessage(chatId, `Подтверждение не совпало. Введите точно: <code>${escapeHtml(expected)}</code>`, {
        replyMarkup: MAIN_MENU,
        parseMode: "HTML",
      });
      return;
    }
    await removeChatForUser(selectedChatId, telegramId);
    await setFlowState(telegramId, null);
    await sendMessage(chatId, "Чат удалён из вашей истории.", { replyMarkup: MAIN_MENU });
    return;
  }

  if (flowState?.startsWith("chat:")) {
    const active = await getActiveChatForUser(telegramId);
    if (!active || String(active.id) !== flowState.slice("chat:".length)) {
      await sendMessage(chatId, "Активного чата нет. Нажмите «Пообщаться», чтобы найти собеседника.", {
        replyMarkup: MAIN_MENU,
      });
      return;
    }
    const other = await getOtherMember(active.id, telegramId);
    if (!other) {
      await sendMessage(chatId, "Собеседник больше недоступен.", { replyMarkup: MAIN_MENU });
      return;
    }
    await saveMessage(active.id, telegramId, text);
    await sendMessage(Number(other.telegramUserId), `💬 <b>Собеседник</b>\n${escapeHtml(text)}`, {
      replyMarkup: CHAT_MENU,
      parseMode: "HTML",
    });
    return;
  }

  await showMainMenu(chatId);
}

async function handleCallbackQuery(query: TelegramCallbackQuery) {
  const message = query.message;
  if (!message) return;
  const telegramId = telegramUserId(query.from);
  const chatId = message.chat.id;
  const data = query.data ?? "";
  await upsertTelegramUser({
    telegramUserId: telegramId,
    username: query.from.username,
    firstName: query.from.first_name,
  });
  await answerCallbackQuery(query.id);
  await deleteMessage(chatId, message.message_id);

  if (data === "history") {
    await showHistory(chatId, telegramId);
    return;
  }
  if (data === "main") {
    await showMainMenu(chatId);
    return;
  }
  const [action, rawChatId] = data.split(":");
  const selectedChatId = Number(rawChatId);
  if (!Number.isInteger(selectedChatId)) return;
  if (action === "chat") {
    await showChatActions(chatId, telegramId, selectedChatId);
  } else if (action === "chat-talk") {
    await showChatHistory(chatId, telegramId, selectedChatId);
  } else if (action === "chat-rename") {
    await setFlowState(telegramId, `rename:${selectedChatId}`);
    await sendMessage(chatId, "Введите новое название чата (до 80 символов):", { replyMarkup: MAIN_MENU });
  } else if (action === "chat-delete") {
    const selected = (await getHistoryForUser(telegramId)).find(item => item.chat.id === selectedChatId);
    const expected = `удалить_${selected?.name ?? ""}`;
    await setFlowState(telegramId, `delete:${selectedChatId}`);
    await sendMessage(chatId, `Для удаления введите: <code>${escapeHtml(expected)}</code>`, {
      replyMarkup: MAIN_MENU,
      parseMode: "HTML",
    });
  }
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) return handleCallbackQuery(update.callback_query);
  if (update.message) return handleTextMessage(update.message);
}

export function registerTelegramRoutes(app: Express) {
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    if (!isTelegramWebhookAuthorized(headers, ENV.telegramWebhookSecret)) {
      res.status(401).json({ ok: false });
      return;
    }
    if (!ENV.telegramBotToken) {
      res.status(503).json({ ok: false, error: "Telegram bot is not configured" });
      return;
    }
    res.status(200).json({ ok: true });
    try {
      await processTelegramUpdate(req.body as TelegramUpdate);
    } catch (error) {
      console.error("[Telegram] Update processing failed", error);
    }
  });
}
