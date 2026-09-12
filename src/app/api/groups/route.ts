import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { ensureDemoSeed, getDemoUserId } from "@/lib/demo-seed";

// GET /api/groups — returns the current user's groups PLUS the demo groups
// (A guruh, B guruh) from the system "2af1-demo-user".
export async function GET(req: NextRequest) {
  // Ensure the demo data exists
  try {
    await ensureDemoSeed();
  } catch (e) {
    console.error("[groups GET] demo seed failed:", e);
  }

  const user = await getCurrentUserDb(req);

  const ownerIds: string[] = [];

  // Always include the demo user's groups (A and B with 27 members)
  const demoUserId = await getDemoUserId();
  if (demoUserId) ownerIds.push(demoUserId);

  // Include the current user's groups
  if (user) ownerIds.push(user.id);

  if (ownerIds.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const groups = await db.avatarGroup.findMany({
    where: { ownerId: { in: ownerIds } },
    include: { _count: { select: { avatars: true } } },
    orderBy: [{ ownerId: "asc" }, { createdAt: "asc" }],
  });

  // Tag demo groups
  const result = groups.map((g) => ({
    ...g,
    isDemo: demoUserId ? g.ownerId === demoUserId : false,
  }));

  return NextResponse.json({ groups: result });
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
