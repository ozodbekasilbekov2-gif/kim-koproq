import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

const DEMO_SET_TITLE = "Kim ko'proq...? — 2AF1 so'rovi";
const DEMO_USER_TELEGRAM_ID = "2af1-demo-user";

// Number of questions that MUST exist in the demo set for it to be considered "complete".
// If fewer, the set is deleted and recreated from scratch.
const EXPECTED_QUESTIONS = SEED_QUESTIONS.length; // 29

// Auto-seed: ensures the original 2AF1 demo set exists with ALL questions.
// Deletes any incomplete or stale demo sets first. Idempotent.
async function ensureDemoSeed() {
  // 1) Find ALL existing demo sets — these are sets whose title contains
  //    "Kim ko'proq" or "Birinchi set" or "2AF1" (old naming variants).
  //    We delete ALL of them and recreate a single canonical one.
  const staleDemoSets = await db.questionSet.findMany({
    where: {
      OR: [
        { title: { contains: "Kim ko'proq" } },
        { title: { contains: "2AF1" } },
        { title: { contains: "Birinchi set" } },
      ],
    },
    include: { _count: { select: { questions: true } } },
  });

  // Find a "good" demo set (has the canonical title AND the right number of questions)
  const goodSet = staleDemoSets.find(
    (s) => s.title === DEMO_SET_TITLE && s._count.questions >= EXPECTED_QUESTIONS
  );
  if (goodSet) return; // Already seeded correctly — nothing to do.

  // Delete all stale/incomplete demo sets
  for (const s of staleDemoSets) {
    await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
  }
  console.log(
    `[auto-seed] Deleted ${staleDemoSets.length} stale demo set(s), recreating...`
  );

  // 2) Find or create the demo user (system-owned, no auth credentials)
  let demoUser = await db.user.findUnique({
    where: { telegramId: DEMO_USER_TELEGRAM_ID },
  });
  if (!demoUser) {
    demoUser = await db.user.create({
      data: {
        telegramId: DEMO_USER_TELEGRAM_ID,
        telegramName: "2AF1 Demo",
        firstName: "2AF1",
        lastName: "Guruh",
      },
    });
  }

  // 3) Clean up any old avatars/groups owned by the demo user before recreating
  await db.avatar.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});
  await db.avatarGroup.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});

  // 4) Create groups A and B
  const groupA = await db.avatarGroup.create({
    data: { name: "A guruh", color: "A", ownerId: demoUser.id },
  });
  const groupB = await db.avatarGroup.create({
    data: { name: "B guruh", color: "B", ownerId: demoUser.id },
  });

  // 5) Create all 27 original members as avatars
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

  // 6) Create the demo set
  const set = await db.questionSet.create({
    data: {
      title: DEMO_SET_TITLE,
      description:
        "2AF1 guruhi uchun qiziqarli savollar. Roast, Rostini ayt, Kelajak, Xaos.",
      emoji: "⚡",
      mode: "loose",
      ownerId: demoUser.id,
      isPublic: true,
    },
  });

  // 7) Create all questions
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
    `[auto-seed] ✅ Created demo set "${DEMO_SET_TITLE}" with ${SEED_QUESTIONS.length} questions and ${MEMBERS.length} members`
  );
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
