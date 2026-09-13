import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

// Auto-seed: ensures the original 2AF1 demo set exists for every visitor.
// Creates a system "demo" user (no password, no telegramId) that owns the set,
// plus two avatar groups (A / B) and all 27 original members + 29 questions.
// Idempotent — safe to call on every request; only seeds if missing.

const DEMO_USER_KEY = "2af1-demo-user";
const DEMO_SET_KEY = "kim-koproq-2af1";

async function ensureDemoSeed() {
  // Check if demo set already exists (by title match)
  const existing = await db.questionSet.findFirst({
    where: { title: { startsWith: "Kim ko'proq...? — 2AF1" } },
    include: { _count: { select: { questions: true } } },
  });
  if (existing && existing._count.questions >= 29) {
    return existing;
  }
  if (existing && existing._count.questions < 29) {
    // Demo set exists but is incomplete — delete and reseed
    await db.questionSet.delete({ where: { id: existing.id } });
  }

  // Find or create the demo user (system-owned, no auth credentials)
  let demoUser = await db.user.findUnique({
    where: { telegramId: DEMO_USER_KEY },
  });
  if (!demoUser) {
    demoUser = await db.user.create({
      data: {
        telegramId: DEMO_USER_KEY,
        telegramName: "2AF1 Demo",
        firstName: "2AF1",
        lastName: "Guruh",
      },
    });
  }

  // Create groups A and B
  const groupA = await db.avatarGroup.create({
    data: { name: "A guruh", color: "A", ownerId: demoUser.id },
  });
  const groupB = await db.avatarGroup.create({
    data: { name: "B guruh", color: "B", ownerId: demoUser.id },
  });

  // Create all 27 members as avatars
  for (const m of MEMBERS) {
    const groupId = m.group === "A" ? groupA.id : groupB.id;
    const photoUrl = m.photo ? `/static/members/${m.id}.jpg` : null;
    const iconName = m.photo ? null : "user-secret"; // mafia badge for no-photo members
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

  // Create the demo set
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

  // Create all 29 questions
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
  return set;
}

// POST /api/seed — manually trigger seeding (still works for the user's own copy)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    // Create the user's own copy of the demo set (separate from the public one)
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: user.id },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: user.id },
    });

    const avatars: { id: string }[] = [];
    for (const m of MEMBERS) {
      const groupId = m.group === "A" ? groupA.id : groupB.id;
      const photoUrl = m.photo ? `/static/members/${m.id}.jpg` : null;
      const iconName = m.photo ? null : "user-secret";
      const created = await db.avatar.create({
        data: {
          name: m.name,
          shortName: m.short,
          photoUrl,
          iconName,
          groupId,
          ownerId: user.id,
        },
      });
      avatars.push({ id: created.id });
    }

    const set = await db.questionSet.create({
      data: {
        title: "Kim ko'proq...? — 2AF1 so'rovi",
        description:
          "2AF1 guruhi uchun qiziqarli savollar. Roast, Rostini ayt, Kelajak, Xaos.",
        emoji: "⚡",
        mode: "loose",
        ownerId: user.id,
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
          createdBy: user.id,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      set: { id: set.id, title: set.title },
      groups: [groupA, groupB],
      avatarsCount: avatars.length,
      questionsCount: SEED_QUESTIONS.length,
    });
  } catch (e: any) {
    console.error("[seed] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/seed — public endpoint to ensure the demo set exists for everyone
export async function GET() {
  try {
    const set = await ensureDemoSeed();
    return NextResponse.json({
      ok: true,
      setId: set.id,
      title: set.title,
      questionsCount: SEED_QUESTIONS.length,
      membersCount: MEMBERS.length,
    });
  } catch (e: any) {
    console.error("[seed GET] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
