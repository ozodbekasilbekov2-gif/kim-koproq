import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { id } = await params;
    const avatar = await db.avatar.findUnique({ where: { id } });
    if (!avatar) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (avatar.ownerId !== user.id) {
      return NextResponse.json({ error: "Faqat egasi tahrirlovchi" }, { status: 403 });
    }
    const body = await req.json();
    const data: any = {};
    if (typeof body.name === "string") {
      const n = body.name.trim();
      if (n.length < 1 || n.length > 80) return NextResponse.json({ error: "Ism noto'g'ri" }, { status: 400 });
      data.name = n;
    }
    if (typeof body.shortName === "string") data.shortName = body.shortName.trim().slice(0, 40) || null;
    if (typeof body.photoUrl === "string") data.photoUrl = body.photoUrl.trim().slice(0, 1000) || null;
    if (typeof body.iconName === "string") data.iconName = body.iconName.trim().slice(0, 60) || null;
    if (typeof body.groupId === "string") data.groupId = body.groupId.trim() || null;
    const updated = await db.avatar.update({ where: { id }, data });
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
    const avatar = await db.avatar.findUnique({ where: { id } });
    if (!avatar) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    if (avatar.ownerId !== user.id) {
      return NextResponse.json({ error: "Faqat egasi o'chira oladi" }, { status: 403 });
    }
    await db.avatar.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
