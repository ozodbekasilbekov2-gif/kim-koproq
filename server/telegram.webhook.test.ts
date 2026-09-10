import { describe, expect, it } from "vitest";
import { isTelegramWebhookAuthorized } from "./telegram";

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
});
