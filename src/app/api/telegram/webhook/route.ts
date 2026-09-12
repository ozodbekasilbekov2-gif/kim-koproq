import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { normalizeBotToken, handleUpdate } from "@/lib/telegram-bot";

/**
 * Telegram bot webhook endpoint — restored from original 2AF1 implementation.
 *
 * Bot features (commit 9456ada):
 *   /start, /menu, /cancel, /who commands
 *   ✏️ Savollarni tahrirlash: create / edit / delete questions via chat
 *   👥 Guruhni tanlash: send native Telegram polls for A or B group
 *   poll_answer updates sync to site's votes table
 *   Multi-step conversation state stored in TgSession table
 *   Webhook deliveries deduped via TgUpdate table
 *
 * Secret validation: X-Telegram-Bot-Api-Secret-Token header must match
 * sha256(token + "|kim-koproq").slice(0, 48).
 */
export const maxDuration = 60; // native-poll fan-out is paced; headroom under serverless limit

export async function POST(req: NextRequest) {
  const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    console.error("[tg-webhook] TELEGRAM_BOT_TOKEN is not set or invalid");
    return NextResponse.json({ error: "Bot token not set" }, { status: 500 });
  }

  // Validate webhook secret
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = createHash("sha256")
    .update(token + "|kim-koproq")
    .digest("hex")
    .slice(0, 48);

  if (!secret || secret !== expectedSecret) {
    const got = secret ? secret.slice(0, 8) + "…" : "none";
    const exp = expectedSecret.slice(0, 8) + "…";
    console.error(
      `[tg-webhook] secret mismatch: got=${got} expected=${exp} (token mask ${token.slice(0, 4)}…${token.slice(-4)}, len ${token.length})`
    );
    return NextResponse.json({ error: "bad secret" }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (e: any) {
    console.error("[tg-webhook] update failed:", e);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  const mask = token ? `${token.slice(0, 4)}…${token.slice(-4)} (len ${token.length})` : "(not set)";
  return NextResponse.json({
    status: "ok",
    bot: mask,
    message: "Telegram webhook is live. Configure webhook with:",
    command: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://your-app.vercel.app/api/telegram/webhook" -d "secret_token=$(echo -n '<TOKEN>|kim-koproq' | sha256sum | cut -c1-48)"`,
  });
}
