import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await db.questionSet.findUnique({
    where: { id },
    include: {
      questions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      owner: { select: { id: true, firstName: true, lastName: true, telegramName: true } },
    },
  });
  if (!set) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  if (!set.isPublic) {
    const user = await getCurrentUserDb(req);
    if (!user || user.id !== set.ownerId) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
  }
  return NextResponse.json(set);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const set = await db.questionSet.findUnique({ where: { id } });
    if (!set) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (set.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Faqat egasi tahrirlay oladi" }, { status: 403 });
    }
    const body = await req.json();
    const data: any = {};
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120);
    if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500) || null;
    if (typeof body.emoji === "string") data.emoji = body.emoji.trim().slice(0, 8);
    if (body.mode === "strict" || body.mode === "loose") data.mode = body.mode;
    if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;
    const updated = await db.questionSet.update({ where: { id }, data });
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
    const set = await db.questionSet.findUnique({ where: { id } });
    if (!set) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (set.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Faqat egasi o'chira oladi" }, { status: 403 });
    }
    await db.questionSet.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
