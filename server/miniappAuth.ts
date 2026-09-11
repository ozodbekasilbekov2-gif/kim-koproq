import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "./_core/env";
import { upsertTelegramUser } from "./db";

export type MiniAppTelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateTelegramInitData(initData: string, maxAgeSeconds = 86_400): MiniAppTelegramUser {
  if (!ENV.telegramBotToken) throw new Error("Telegram bot is not configured");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!hash || !authDate || !userRaw) throw new Error("Incomplete Telegram initData");
  if (Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) throw new Error("Expired Telegram initData");

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(ENV.telegramBotToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(expectedHash, hash)) throw new Error("Invalid Telegram initData signature");

  const user = JSON.parse(userRaw) as MiniAppTelegramUser;
  if (!user.id) throw new Error("Telegram user is missing");
  return user;
}

export async function authenticateMiniAppRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const initData = String(req.header("x-telegram-init-data") ?? req.body?.initData ?? "");
    const telegramUser = validateTelegramInitData(initData);
    await upsertTelegramUser({
      telegramUserId: String(telegramUser.id),
      username: telegramUser.username,
      firstName: telegramUser.first_name,
    });
    res.locals.telegramUser = telegramUser;
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" });
  }
}
