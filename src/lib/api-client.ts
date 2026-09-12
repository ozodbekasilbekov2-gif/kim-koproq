import { getStoredTgToken } from "@/lib/telegram-client";

let sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("kk_session", token);
    else localStorage.removeItem("kk_session");
  }
}

export function getAuthToken(): string | null {
  if (sessionToken) return sessionToken;
  if (typeof window !== "undefined") {
    // Prefer Telegram JWT if present (Mini App context)
    const tg = getStoredTgToken();
    if (tg) return tg;
    const s = localStorage.getItem("kk_session");
    if (s) return s;
  }
  return null;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"] && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(path, { ...init, headers });
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let msg: string;
    try {
      const j = await res.json();
      msg = j.error || j.message || `HTTP ${res.status}`;
    } catch {
      msg = await res.text().catch(() => `HTTP ${res.status}`);
    }
    throw new Error(msg);
  }
  return res.json();
}
