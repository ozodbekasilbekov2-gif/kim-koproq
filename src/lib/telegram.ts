import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Telegram WebApp initData validation.
 * Validates the HMAC signature sent by Telegram from the Mini App.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export function webhookSecret(token: string): string {
  return createHash("sha256").update(token).digest();
}

/**
 * Validates Telegram Mini App initData string.
 * Returns the parsed user object if valid, otherwise null.
 */
export function validateTelegramInitData(initData: string, botToken: string): {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
} | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");

    // Build data_check_string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = webhookSecret(botToken);
    const computedHash = createHash("sha256")
      .update(dataCheckString)
      .update(secretKey)
      .digest();

    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(computedHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // Check auth_date not older than 1 hour
    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null; // 24h tolerance for mini-app sessions

    const userRaw = params.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (typeof user.id !== "number") return null;

    return user;
  } catch (e) {
    console.error("[telegram-init-data] validation failed:", e);
    return null;
  }
}

export function normalizeBotToken(token?: string): string | null {
  if (!token) return null;
  const t = token.trim();
  // token format: "<bot_id>:<secret>"
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,45}$/.test(t)) return null;
  return t;
}
