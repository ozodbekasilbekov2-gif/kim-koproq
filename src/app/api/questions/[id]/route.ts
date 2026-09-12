import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const q = await db.question.findUnique({ where: { id }, include: { set: true } });
    if (!q || q.deletedAt) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    // strict: only set owner can edit; loose: any logged-in user
    if (q.set.mode === "strict" && q.set.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Bu set strict rejimda — faqat egasi tahrirlovchi" }, { status: 403 });
    }
    const body = await req.json();
    const text = (body.text ?? q.text).trim();
    if (text.length < 5 || text.length > 200) {
      return NextResponse.json({ error: "Savol 5–200 belgi bo'lsin" }, { status: 400 });
    }
    const emoji = (body.emoji ?? q.emoji).trim().slice(0, 8) || "❓";
    const category = (body.category ?? q.category).trim().slice(0, 40);
    const updated = await db.question.update({
      where: { id },
      data: { text, emoji, category, updatedBy: user.id },
    });
    await db.questionHistory.create({
      data: { questionId: id, action: "edit", actor: user.id, oldText: q.text, newText: text },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const q = await db.question.findUnique({ where: { id }, include: { set: true } });
    if (!q || q.deletedAt) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (q.set.mode === "strict" && q.set.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Bu set strict rejimda — faqat egasi o'chira oladi" }, { status: 403 });
    }
    await db.question.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
    await db.questionHistory.create({
      data: { questionId: id, action: "delete", actor: user.id, oldText: q.text },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
