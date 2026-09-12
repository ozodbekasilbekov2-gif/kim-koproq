import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questions = await db.question.findMany({
    where: { setId: id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const set = await db.questionSet.findUnique({ where: { id } });
    if (!set) return NextResponse.json({ error: "Set topilmadi" }, { status: 404 });
    // strict mode: only owner can add; loose: any logged-in user
    if (set.mode === "strict" && set.ownerId !== user.id) {
      return NextResponse.json({ error: "Bu setda faqat egasi savol qo'sha oladi (strict rejim)" }, { status: 403 });
    }
    const body = await req.json();
    const text = (body.text || "").trim();
    if (text.length < 5 || text.length > 200) {
      return NextResponse.json({ error: "Savol 5–200 belgi bo'lsin" }, { status: 400 });
    }
    const emoji = (body.emoji || "❓").trim().slice(0, 8);
    const category = (body.category || "Xaos").trim().slice(0, 40);
    const q = await db.question.create({
      data: { text, emoji, category, setId: id, createdBy: user.id },
    });
    await db.questionHistory.create({
      data: { questionId: q.id, action: "add", actor: user.id, newText: text },
    });
    return NextResponse.json(q);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
