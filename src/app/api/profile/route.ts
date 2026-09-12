import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    telegramId: user.telegramId,
    telegramName: user.telegramName,
    telegramPhoto: user.telegramPhoto,
    role: user.role,
    createdAt: user.createdAt,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const body = await req.json();
    const data: any = {};
    if (typeof body.firstName === "string") {
      data.firstName = body.firstName.trim().slice(0, 60) || null;
    }
    if (typeof body.lastName === "string") {
      data.lastName = body.lastName.trim().slice(0, 60) || null;
    }
    if (typeof body.avatarUrl === "string") {
      data.avatarUrl = body.avatarUrl.trim().slice(0, 1000) || null;
    }
    const updated = await db.user.update({ where: { id: user.id }, data });
    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatarUrl: updated.avatarUrl,
      telegramName: updated.telegramName,
      telegramPhoto: updated.telegramPhoto,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
