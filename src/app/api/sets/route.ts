import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { ensureUserDemoSet } from "@/lib/demo-seed";

// List all public sets + sets owned by user
// Also ensures the logged-in user has their OWN personal demo set.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);

  // If the user is logged in, ensure they have their own personal demo set
  // (27 avatars + 29 questions). This gives each user their own share link
  // and their own results page.
  if (user) {
    try {
      await ensureUserDemoSet(user.id);
    } catch (e) {
      console.error("[sets GET] user demo set creation failed:", e);
    }
  }

  const where = user
    ? { OR: [{ isPublic: true }, { ownerId: user.id }] }
    : { isPublic: true };
  const sets = await db.questionSet.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: { where: { deletedAt: null } } } },
      owner: { select: { firstName: true, lastName: true, telegramName: true, email: true } },
    },
  });
  return NextResponse.json({ sets });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiya talab qilinadi" }, { status: 401 });
    }
    const body = await req.json();
    const title = (body.title || "").trim();
    if (title.length < 2 || title.length > 120) {
      return NextResponse.json({ error: "Sarlavha 2–120 belgi bo'lsin" }, { status: 400 });
    }
    const description = (body.description || "").trim().slice(0, 500) || null;
    const emoji = (body.emoji || "❓").trim().slice(0, 8);
    const mode = body.mode === "loose" ? "loose" : "strict";
    // groupIds: JSON-encoded array of AvatarGroup IDs
    let groupIdsJson: string | null = null;
    if (Array.isArray(body.groupIds)) {
      groupIdsJson = JSON.stringify(body.groupIds.filter((id: any) => typeof id === "string"));
    }
    const set = await db.questionSet.create({
      data: {
        title,
        description,
        emoji,
        mode,
        ownerId: user.id,
        isPublic: body.isPublic !== false,
        groupIds: groupIdsJson,
      },
    });
    return NextResponse.json(set);
  } catch (e: any) {
    console.error("[sets POST] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
