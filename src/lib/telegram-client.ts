/**
 * Standalone Telegram Mini App auth helper (no dependency on NextAuth on the client side).
 * - Detects Telegram WebApp via window.Telegram.WebApp
 * - Reads initData from the SDK
 * - POSTs to /api/telegram/auth to validate it and get a JWT
 * - Stores JWT in localStorage and sends in Authorization header for fetches
 */

export const TG_JWT_KEY = "kk_tg_token";

export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w.Telegram?.WebApp?.initData && w.Telegram.WebApp.initData.length > 0) {
    return w.Telegram.WebApp.initData;
  }
  return null;
}

export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.Telegram?.WebApp?.initData && w.Telegram.WebApp.initData.length > 0);
}

export function getStoredTgToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TG_JWT_KEY);
}

export function setStoredTgToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TG_JWT_KEY, token);
  else localStorage.removeItem(TG_JWT_KEY);
}

export async function loginViaTelegram(): Promise<{ token: string; user: any } | null> {
  const initData = getTelegramInitData();
  if (!initData) return null;
  const res = await fetch("/api/telegram/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) {
    console.warn("[telegram-auth] failed:", await res.text());
    return null;
  }
  const data = await res.json();
  if (!data.token) return null;
  setStoredTgToken(data.token);
  return data;
}
