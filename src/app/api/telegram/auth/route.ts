import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateTelegramInitData, normalizeBotToken } from "@/lib/telegram";
import { signJwt } from "@/lib/jwt";
import { ensureUserDemoSet } from "@/lib/demo-seed";

/**
 * Telegram Mini App auto-login endpoint.
 * Receives initData from frontend (from window.Telegram.WebApp.initData),
 * validates it server-side, finds-or-creates the user, returns a JWT token
 * that the frontend stores and sends in Authorization header for API requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const initData = body.initData;
    if (!initData || typeof initData !== "string" || initData.length < 10) {
      return NextResponse.json(
        { error: "initData talab qilinadi (Telegram Mini App ichidan oching)" },
        { status: 400 }
      );
    }

    const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
    if (!token) {
      console.error("[telegram/auth] TELEGRAM_BOT_TOKEN not set or invalid format");
      return NextResponse.json(
        { error: "Bot token sozlanmagan (server adminiga murojaat qiling)" },
        { status: 500 }
      );
    }

    const tgUser = validateTelegramInitData(initData, token);
    if (!tgUser) {
      console.warn("[telegram/auth] initData validation failed for token:", token.slice(0, 4) + "…");
      return NextResponse.json(
        { error: "initData yaroqsiz — bot token yoki initData mos kelmaydi" },
        { status: 401 }
      );
    }

    let user = await db.user.findUnique({
      where: { telegramId: String(tgUser.id) },
    });
    if (!user) {
      user = await db.user.create({
        data: {
          telegramId: String(tgUser.id),
          telegramName: tgUser.username || tgUser.first_name || null,
          firstName: tgUser.first_name || null,
          lastName: tgUser.last_name || null,
          telegramPhoto: tgUser.photo_url || null,
        },
      });
      console.log("[telegram/auth] Created new user for Telegram ID:", tgUser.id);
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          telegramName: tgUser.username || tgUser.first_name || user.telegramName,
          firstName: tgUser.first_name || user.firstName,
          lastName: tgUser.last_name || user.lastName,
          telegramPhoto: tgUser.photo_url || user.telegramPhoto,
        },
      });
    }

    // Ensure the user has their OWN personal demo set (27 avatars + 29 questions)
    try {
      await ensureUserDemoSet(user.id);
    } catch (e) {
      console.error("[telegram/auth] demo set creation failed:", e);
    }

    const jwt = await signJwt({
      uid: user.id,
      tg: user.telegramId,
    });

    return NextResponse.json({
      token: jwt,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        telegramName: user.telegramName,
        avatarUrl: user.avatarUrl || user.telegramPhoto,
        telegramId: user.telegramId,
      },
    });
  } catch (e: any) {
    console.error("[telegram/auth] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
