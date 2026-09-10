import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { isTelegramWebhookAuthorized } from "./telegram";

describe("Telegram integration", () => {
  it("accepts the configured webhook secret only", () => {
    if (!ENV.telegramWebhookSecret) {
      throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
    }
    expect(
      isTelegramWebhookAuthorized(
        { "x-telegram-bot-api-secret-token": ENV.telegramWebhookSecret },
        ENV.telegramWebhookSecret
      )
    ).toBe(true);
    expect(
      isTelegramWebhookAuthorized(
        { "x-telegram-bot-api-secret-token": "wrong-secret" },
        ENV.telegramWebhookSecret
      )
    ).toBe(false);
  });

  it("validates the configured bot token with Telegram getMe", async () => {
    if (!ENV.telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }
    const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/getMe`);
    const payload = (await response.json()) as { ok: boolean; result?: { is_bot?: boolean } };
    expect(response.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.result?.is_bot).toBe(true);
  }, 15_000);
});
