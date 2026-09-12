import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const group = await db.avatarGroup.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (group.ownerId !== user.id) {
      return NextResponse.json({ error: "Faqat egasi tahrirlovchi" }, { status: 403 });
    }
    const body = await req.json();
    const data: any = {};
    if (typeof body.name === "string") {
      const n = body.name.trim();
      if (n.length < 1 || n.length > 60) return NextResponse.json({ error: "Noto'g'ri nom" }, { status: 400 });
      data.name = n;
    }
    if (typeof body.color === "string") data.color = body.color.trim().slice(0, 20);
    const updated = await db.avatarGroup.update({ where: { id }, data });
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
    const group = await db.avatarGroup.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (group.ownerId !== user.id) {
      return NextResponse.json({ error: "Faqat egasi o'chira oladi" }, { status: 403 });
    }
    // detach avatars first (set groupId null)
    await db.avatar.updateMany({ where: { groupId: id }, data: { groupId: null } });
    await db.avatarGroup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
