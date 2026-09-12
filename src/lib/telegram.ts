import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram WebApp initData validation.
 * Validates the HMAC signature sent by Telegram from the Mini App.
 *
 * Algorithm (per Telegram docs):
 *   1. Parse initData as URLSearchParams
 *   2. Extract and remove the `hash` parameter
 *   3. Sort remaining params alphabetically by key
 *   4. Build data_check_string = "key1=value1\nkey2=value2\n..."
 *   5. secret_key = HMAC-SHA256(key="WebAppData", message=bot_token)
 *   6. computed_hash = HMAC-SHA256(key=secret_key, message=data_check_string) as hex
 *   7. Compare computed_hash with received hash (timing-safe)
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

/**
 * Webhook secret — used for validating the X-Telegram-Bot-Api-Secret-Token
 * header when Telegram delivers updates to our webhook endpoint.
 * This is a CUSTOM secret we set via setWebhook, NOT the same as initData validation.
 */
export function webhookSecret(token: string): string {
  return createHash("sha256")
    .update(token + "|kim-koproq")
    .digest("hex")
    .slice(0, 48);
}

/**
 * Validates Telegram Mini App initData string.
 * Returns the parsed user object if valid, otherwise null.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): {
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

    // Build data_check_string: sort params alphabetically, join as "key=value\n..."
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // Step 1: create secret_key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Step 2: compute hash = HMAC-SHA256(secret_key, data_check_string) as hex
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Step 3: timing-safe comparison
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(computedHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.warn(
        "[telegram-init-data] hash mismatch — initData may be tampered or bot token is wrong"
      );
      return null;
    }

    // Check auth_date not older than 24 hours (tolerance for mini-app sessions)
    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.warn("[telegram-init-data] auth_date too old:", authDate);
      return null;
    }

    // Parse the user object from the `user` param
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
  let t = token.trim();
  // Strip surrounding quotes
  if (
    t.length > 1 &&
    ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'")))
  ) {
    t = t.slice(1, -1).trim();
  }
  // Strip "NAME=" prefix if present
  const eq = t.indexOf("=");
  if (eq > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t.slice(0, eq))) {
    t = t.slice(eq + 1).trim();
  }
  // Validate format: <bot_id>:<secret>
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,45}$/.test(t)) return null;
  return t;
}
