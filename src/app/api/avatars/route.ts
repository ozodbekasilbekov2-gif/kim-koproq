import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
  if (!user) return NextResponse.json({ avatars: [] });
  const avatars = await db.avatar.findMany({
    where: { ownerId: user.id },
    include: { group: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ avatars });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const body = await req.json();
    const name = (body.name || "").trim();
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: "Ism 1–80 belgi bo'lsin" }, { status: 400 });
    }
    const shortName = (body.shortName || "").trim().slice(0, 40) || null;
    const photoUrl = (body.photoUrl || "").trim().slice(0, 1000) || null;
    const iconName = (body.iconName || "").trim().slice(0, 60) || null;
    const groupId = (body.groupId || "").trim() || null;
    if (!photoUrl && !iconName) {
      return NextResponse.json({ error: "Rasm yoki professional ikonkadan birini tanlang" }, { status: 400 });
    }
    const avatar = await db.avatar.create({
      data: { name, shortName, photoUrl, iconName, groupId, ownerId: user.id },
    });
    return NextResponse.json(avatar);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
