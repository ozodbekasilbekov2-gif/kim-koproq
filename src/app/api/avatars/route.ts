import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { ensureDemoSeed, getDemoUserId } from "@/lib/demo-seed";

// GET /api/avatars — returns the current user's avatars PLUS the 27 demo avatars
// from the system "2af1-demo-user". This ensures everyone can see and use the
// 27 original 2AF1 members in tests, even on first visit / new registration.
//
// Optional query param: ?setId=xxx — if provided, loads avatars from that set's
// owner instead (useful when taking a test in someone else's set).
export async function GET(req: NextRequest) {
  // Ensure the demo data exists (27 avatars + groups + set + questions)
  try {
    await ensureDemoSeed();
  } catch (e) {
    console.error("[avatars GET] demo seed failed:", e);
  }

  const user = await getCurrentUserDb(req);

  // Determine which owners' avatars to load:
  // 1. The demo user (always — for the 27 2AF1 members)
  // 2. The current user (if logged in — for their own custom avatars)
  // 3. A specific set's owner (if ?setId= is provided)
  const ownerIds: string[] = [];

  // Always include the demo user's avatars
  const demoUserId = await getDemoUserId();
  if (demoUserId) ownerIds.push(demoUserId);

  // Include the current user's avatars
  if (user) ownerIds.push(user.id);

  // Include a specific set's owner if requested
  const setId = req.nextUrl.searchParams.get("setId");
  if (setId) {
    const set = await db.questionSet.findUnique({
      where: { id: setId },
      select: { ownerId: true },
    });
    if (set && !ownerIds.includes(set.ownerId)) {
      ownerIds.push(set.ownerId);
    }
  }

  if (ownerIds.length === 0) {
    return NextResponse.json({ avatars: [] });
  }

  const avatars = await db.avatar.findMany({
    where: { ownerId: { in: ownerIds } },
    include: { group: true },
    orderBy: [{ ownerId: "asc" }, { createdAt: "asc" }],
  });

  // Tag each avatar with whether it's a "demo" avatar (owned by the demo user)
  // so the frontend can distinguish them from the user's own avatars.
  const result = avatars.map((a) => ({
    ...a,
    isDemo: demoUserId ? a.ownerId === demoUserId : false,
  }));

  return NextResponse.json({ avatars: result });
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
