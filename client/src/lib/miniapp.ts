export type MiniProfile = {
  displayName: string;
  iconKey: string;
  accentColor: string;
};

export type MiniTag = {
  id: number;
  label: string;
  deletedAt: string | null;
};

export type MiniChat = {
  id: number;
  name: string;
  iconKey: string;
  color: string;
  status: "waiting" | "active" | "closed";
  deletedAt: string | null;
  other: MiniProfile;
  sharedTags: string[];
};

export type MiniMessage = {
  id: number;
  chatId: number;
  senderTelegramUserId: string;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type MiniSettings = {
  fontScale: "small" | "medium" | "large";
  chatBackground: "paper" | "mist" | "night" | "peach";
  messageColor: string;
  theme: "light" | "dark";
};

export type MiniState = {
  profile: MiniProfile;
  settings: MiniSettings;
  tags: MiniTag[];
  deletedTags: MiniTag[];
  chats: MiniChat[];
  deletedChats: MiniChat[];
};

export type ChatPayload = { chat: MiniChat; messages: MiniMessage[] };

type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (callback: () => void) => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData ?? "";
}

export async function miniApi<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  const initData = getTelegramInitData();
  if (initData) headers.set("x-telegram-init-data", initData);
  const response = await fetch(`/api/miniapp${path}`, { ...options, headers });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Mini App request failed");
  return payload;
}

export async function loadMiniState() {
  return miniApi<MiniState>("/state");
}

export const demoState: MiniState = {
  profile: { displayName: "Собеседник", iconKey: "message-circle", accentColor: "#6d5dfc" },
  settings: { fontScale: "medium", chatBackground: "paper", messageColor: "#172033", theme: "light" },
  tags: [
    { id: 1, label: "кино", deletedAt: null },
    { id: 2, label: "путешествия", deletedAt: null },
    { id: 3, label: "дизайн", deletedAt: null },
  ],
  deletedTags: [],
  chats: [
    { id: 430, name: "Ночной диалог", iconKey: "message-circle", color: "#e35d6a", status: "active", deletedAt: null, other: { displayName: "Анонимный собеседник", iconKey: "heart-handshake", accentColor: "#e35d6a" }, sharedTags: ["кино", "путешествия"] },
    { id: 431, name: "Идеи и мысли", iconKey: "lightbulb", color: "#1da89b", status: "closed", deletedAt: null, other: { displayName: "Новый знакомый", iconKey: "sparkles", accentColor: "#1da89b" }, sharedTags: ["дизайн"] },
    { id: 427, name: "Музыка", iconKey: "music-2", color: "#4f86f7", status: "active", deletedAt: null, other: { displayName: "Анонимный собеседник", iconKey: "music-2", accentColor: "#4f86f7" }, sharedTags: ["кино"] },
  ],
  deletedChats: [],
};
