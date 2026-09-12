import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { normalizeBotToken } from "@/lib/telegram";

/**
 * Telegram bot webhook endpoint.
 * Currently the bot only forwards users to the Mini App via inline keyboard.
 * Full bot logic with native polls can be added later — this endpoint
 * keeps the bot webhook contract so Telegram accepts the URL.
 */
export async function POST(req: NextRequest) {
  const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    return NextResponse.json({ error: "Bot token not set" }, { status: 500 });
  }
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = createHash("sha256")
    .update(token + "|kim-koproq")
    .digest("hex")
    .slice(0, 48);

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "bad secret" }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Handle /start command — send a button that opens the Mini App
    if (update.message?.text === "/start" || update.message?.text?.startsWith("/start ")) {
      const chatId = update.message.chat.id;
      const tgToken = token;
      const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || process.env.NEXTAUTH_URL || "https://kim-koproq.vercel.app";

      const payload = {
        chat_id: chatId,
        text: "👋 Salom!\n\nBu bot orqali \"Kim ko'proq?\" testlarini yaratasan, odamlarni qo'shasan va ovoz berib natijalarni ko'rasan.\n\nQuyidagi tugmani bosing 👇",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Mini App ni ochish",
                web_app: { url: miniAppUrl },
              },
            ],
          ],
        },
      };

      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    // Handle callback_query for inline button taps
    if (update.callback_query) {
      const cbId = update.callback_query.id;
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId }),
      });
    }
  } catch (e: any) {
    console.error("[telegram/webhook] error:", e);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  const mask = token ? `${token.slice(0, 4)}…${token.slice(-4)}` : "(not set)";
  return NextResponse.json({
    status: "ok",
    bot: mask,
    message: "Telegram webhook is live. Configure webhook with: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/telegram/webhook&secret_token=<SECRET>",
  });
}
