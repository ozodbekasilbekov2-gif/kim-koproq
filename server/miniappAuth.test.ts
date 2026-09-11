import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { validateTelegramInitData } from "./miniappAuth";

function signedInitData(overrides: { authDate?: number; hash?: string } = {}) {
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const user = JSON.stringify({ id: 123456, first_name: "Test", username: "test_user" });
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "AAE-test", user });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(ENV.telegramBotToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", overrides.hash ?? hash);
  return params.toString();
}

describe("Telegram Mini App initData", () => {
  it("accepts a valid signed payload and returns the Telegram user", () => {
    const user = validateTelegramInitData(signedInitData());
    expect(user).toMatchObject({ id: 123456, username: "test_user" });
  });

  it("rejects tampered and expired payloads", () => {
    expect(() => validateTelegramInitData(signedInitData({ hash: "00" }))).toThrow("Invalid Telegram initData signature");
    expect(() => validateTelegramInitData(signedInitData({ authDate: Math.floor(Date.now() / 1000) - 86_401 }))).toThrow("Expired Telegram initData");
  });
});
