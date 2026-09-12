/**
 * Standalone Telegram Mini App auth helper (no dependency on NextAuth on the client side).
 * - Detects Telegram WebApp via window.Telegram.WebApp
 * - Waits for the SDK script to load (it's async in <head>)
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

/**
 * Wait for the Telegram WebApp SDK to be ready.
 * The SDK script is loaded async in <head>, so on first mount window.Telegram
 * may be undefined. We poll every 100ms for up to 5 seconds.
 *
 * Returns true if Telegram WebApp is available, false on timeout.
 */
export async function waitForTelegramSdk(timeoutMs = 5000): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const w = window as any;
    if (w.Telegram?.WebApp && typeof w.Telegram.WebApp.initData !== "undefined") {
      // SDK is ready — call ready() to signal Telegram that we're loaded
      try {
        w.Telegram.WebApp.ready();
        w.Telegram.WebApp.expand();
      } catch {}
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
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

/**
 * Full Telegram login flow:
 * 1. Wait for SDK to load (up to 5s)
 * 2. Check if we're actually in a Telegram Mini App context
 * 3. Get initData and POST to /api/telegram/auth
 * 4. Store the JWT token
 *
 * Returns { token, user } on success, null if not in Telegram or auth failed.
 */
export async function loginViaTelegram(): Promise<{ token: string; user: any } | null> {
  // Step 1: wait for the SDK to be ready
  const sdkReady = await waitForTelegramSdk(5000);
  if (!sdkReady) {
    console.warn("[telegram-auth] SDK did not load within 5s — not in Telegram Mini App");
    return null;
  }

  // Step 2: check if we have initData
  const initData = getTelegramInitData();
  if (!initData) {
    console.warn("[telegram-auth] SDK loaded but initData is empty");
    return null;
  }

  // Step 3: POST to our auth endpoint for server-side validation + JWT issuance
  try {
    const res = await fetch("/api/telegram/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[telegram-auth] server rejected:", res.status, errText);
      return null;
    }
    const data = await res.json();
    if (!data.token) {
      console.warn("[telegram-auth] no token in response:", data);
      return null;
    }
    setStoredTgToken(data.token);
    return data;
  } catch (e) {
    console.error("[telegram-auth] network error:", e);
    return null;
  }
}
