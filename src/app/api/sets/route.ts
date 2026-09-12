import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

// Auto-seed: ensures the original 2AF1 demo set exists for every visitor.
// Idempotent — only creates if missing. Uses a system "demo" user as owner.
async function ensureDemoSeed() {
  const existing = await db.questionSet.findFirst({
    where: { title: { startsWith: "Kim ko'proq...? — 2AF1" } },
    include: { _count: { select: { questions: true } } },
  });
  if (existing && existing._count.questions >= 32) return;
  if (existing) {
    await db.questionSet.delete({ where: { id: existing.id } });
  }
  // Trigger the seed endpoint's GET logic by importing it lazily
  const res = await fetch(
    `http://localhost:${process.env.PORT || 3000}/api/seed`
  ).catch(() => null);
  if (!res || !res.ok) {
    // Fallback: create inline
    const { MEMBERS, SEED_QUESTIONS } = await import("@/lib/original-data");
    let demoUser = await db.user.findUnique({
      where: { telegramId: "2af1-demo-user" },
    });
    if (!demoUser) {
      demoUser = await db.user.create({
        data: {
          telegramId: "2af1-demo-user",
          telegramName: "2AF1 Demo",
          firstName: "2AF1",
          lastName: "Guruh",
        },
      });
    }
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: demoUser.id },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: demoUser.id },
    });
    for (const m of MEMBERS) {
      const groupId = m.group === "A" ? groupA.id : groupB.id;
      const photoUrl = m.photo ? `/static/members/${m.id}.jpg` : null;
      const iconName = m.photo ? null : "user-secret";
      await db.avatar.create({
        data: {
          name: m.name,
          shortName: m.short,
          photoUrl,
          iconName,
          groupId,
          ownerId: demoUser.id,
        },
      });
    }
    const set = await db.questionSet.create({
      data: {
        title: "Kim ko'proq...? — 2AF1 so'rovi",
        description:
          "2AF1 guruhi uchun qiziqarli savollar. Roast, Rostini ayt, Kelajak, Xaos.",
        emoji: "⚡",
        mode: "loose",
        ownerId: demoUser.id,
        isPublic: true,
      },
    });
    for (const q of SEED_QUESTIONS) {
      await db.question.create({
        data: {
          text: q.text,
          emoji: q.emoji,
          category: q.category,
          setId: set.id,
          createdBy: demoUser.id,
        },
      });
    }
    console.log(
      `[auto-seed] Created demo set with ${SEED_QUESTIONS.length} questions and ${MEMBERS.length} members`
    );
  }
}

// List all public sets + sets owned by user
export async function GET(req: NextRequest) {
  // Auto-seed the original 2AF1 demo set if it doesn't exist yet
  try {
    await ensureDemoSeed();
  } catch (e) {
    console.error("[sets GET] auto-seed failed:", e);
    // Continue anyway — don't break the listing
  }

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
