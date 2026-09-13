import { describe, expect, it } from "vitest";
import { chunkTelegramMessageIds, isTelegramWebhookAuthorized } from "./telegram";

describe("Telegram webhook authorization", () => {
  it("allows requests without a configured secret for local development", () => {
    expect(isTelegramWebhookAuthorized({}, "")).toBe(true);
  });

  it("rejects missing and incorrect secrets", () => {
    expect(isTelegramWebhookAuthorized({}, "expected")).toBe(false);
    expect(
      isTelegramWebhookAuthorized({ "x-telegram-bot-api-secret-token": "other" }, "expected")
    ).toBe(false);
  });

  it("accepts the exact Telegram secret", () => {
    expect(
      isTelegramWebhookAuthorized(
        { "x-telegram-bot-api-secret-token": "expected" },
        "expected"
      )
    ).toBe(true);
  });

  it("splits tracked message ids into Telegram-safe batches of 100", () => {
    const ids = Array.from({ length: 205 }, (_, index) => index + 1);
    const chunks = chunkTelegramMessageIds(ids);
    expect(chunks.map(chunk => chunk.length)).toEqual([100, 100, 5]);
    expect(chunks.flat()).toEqual(ids);
  });
});
