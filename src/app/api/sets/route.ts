import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

// List all public sets + sets owned by user
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
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
    const set = await db.questionSet.create({
      data: {
        title,
        description,
        emoji,
        mode,
        ownerId: user.id,
        isPublic: body.isPublic !== false,
      },
    });
    return NextResponse.json(set);
  } catch (e: any) {
    console.error("[sets POST] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
