import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { ensureUserDemoSet } from "@/lib/demo-seed";

// GET /api/avatars — returns avatars.
// - If ?setId= is provided: loads avatars from that set's owner (for guest mode
//   OR for logged-in users viewing someone else's set)
// - If no setId and logged in: loads the current user's avatars
// - If no setId and not logged in: returns empty
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
  const setId = req.nextUrl.searchParams.get("setId");

  // If ?setId= is provided, load avatars from that set's owner
  // (works for both guests AND logged-in users viewing a shared set)
  if (setId) {
    const set = await db.questionSet.findUnique({
      where: { id: setId },
      select: { ownerId: true },
    });
    if (!set) return NextResponse.json({ avatars: [] });

    const avatars = await db.avatar.findMany({
      where: { ownerId: set.ownerId },
      include: { group: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ avatars });
  }

  if (!user) return NextResponse.json({ avatars: [] });

  // Ensure the user has their personal demo avatars
  try {
    await ensureUserDemoSet(user.id);
  } catch (e) {
    console.error("[avatars GET] user demo set failed:", e);
  }

  // Load ONLY the current user's avatars
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
