import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { ensureUserDemoSet } from "@/lib/demo-seed";

// GET /api/groups — returns the current user's groups.
// Each user has their OWN groups (A guruh, B guruh) with their OWN avatars.
//
// Optional query param: ?setId=xxx — if provided (guest mode), loads groups
// from that set's owner instead.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);

  // If ?setId= is provided (guest mode), load groups from that set's owner
  const setId = req.nextUrl.searchParams.get("setId");
  if (setId && !user) {
    const set = await db.questionSet.findUnique({
      where: { id: setId },
      select: { ownerId: true },
    });
    if (!set) return NextResponse.json({ groups: [] });

    const groups = await db.avatarGroup.findMany({
      where: { ownerId: set.ownerId },
      include: { _count: { select: { avatars: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ groups });
  }

  if (!user) return NextResponse.json({ groups: [] });

  // Ensure the user has their personal demo groups
  try {
    await ensureUserDemoSet(user.id);
  } catch (e) {
    console.error("[groups GET] user demo set failed:", e);
  }

  const groups = await db.avatarGroup.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { avatars: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const body = await req.json();
    const name = (body.name || "").trim();
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ error: "Guruh nomi 1–60 belgi bo'lsin" }, { status: 400 });
    }
    const color = (body.color || "A").trim().slice(0, 20);
    const group = await db.avatarGroup.create({
      data: { name, color, ownerId: user.id },
    });
    return NextResponse.json(group);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
