import { db } from "@/lib/db";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

const DEMO_SET_TITLE = "Kim ko'proq...? — 2AF1 so'rovi";
const DEMO_USER_TELEGRAM_ID = "2af1-demo-user";

/**
 * Ensures the original 2AF1 demo data exists:
 *   - A system "demo" user (telegramId="2af1-demo-user")
 *   - Two avatar groups: "A guruh" (14 members) + "B guruh" (13 members)
 *   - 27 avatars (the original 2AF1 members with photos)
 *   - One public question set with 29 questions
 *
 * Idempotent: if everything already exists, returns immediately.
 * Otherwise, creates what's missing. Safe to call from multiple endpoints.
 */
export async function ensureDemoSeed(): Promise<void> {
  // 1) Find or create the demo user
  let demoUser = await db.user.findUnique({
    where: { telegramId: DEMO_USER_TELEGRAM_ID },
  });
  if (!demoUser) {
    try {
      demoUser = await db.user.create({
        data: {
          telegramId: DEMO_USER_TELEGRAM_ID,
          telegramName: "2AF1 Demo",
          firstName: "2AF1",
          lastName: "Guruh",
        },
      });
    } catch {
      // Race condition — another request created it
      demoUser = await db.user.findUnique({
        where: { telegramId: DEMO_USER_TELEGRAM_ID },
      });
      if (!demoUser) return;
    }
  }

  // 2) Check if the demo user has 27 avatars
  const avatarCount = await db.avatar.count({
    where: { ownerId: demoUser.id },
  });

  if (avatarCount < MEMBERS.length) {
    // Need to (re)create avatars — clean up first
    await db.avatar.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});
    await db.avatarGroup.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});

    // Create groups
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: demoUser.id },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: demoUser.id },
    });

    // Create all 27 avatars
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
    console.log(`[ensureDemoSeed] Created ${MEMBERS.length} demo avatars in 2 groups`);
  }

  // 3) Check if the demo set exists with enough questions
  const existingSet = await db.questionSet.findFirst({
    where: { title: DEMO_SET_TITLE },
    include: { _count: { select: { questions: true } } },
  });

  if (!existingSet || existingSet._count.questions < SEED_QUESTIONS.length) {
    // Delete old incomplete demo sets
    const staleSets = await db.questionSet.findMany({
      where: {
        OR: [
          { title: DEMO_SET_TITLE },
          { title: { contains: "Kim ko'proq" } },
          { title: { contains: "2AF1" } },
          { title: { contains: "Birinchi set" } },
        ],
      },
    });
    for (const s of staleSets) {
      await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
    }

    // Create the demo set
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
      `[ensureDemoSeed] Created demo set "${DEMO_SET_TITLE}" with ${SEED_QUESTIONS.length} questions`
    );
  }
}

/**
 * Returns the demo user's ID (creates the demo user if it doesn't exist).
 * Used by /api/avatars and /api/groups to always include demo data.
 */
export async function getDemoUserId(): Promise<string | null> {
  let demoUser = await db.user.findUnique({
    where: { telegramId: DEMO_USER_TELEGRAM_ID },
  });
  if (!demoUser) {
    try {
      demoUser = await db.user.create({
        data: {
          telegramId: DEMO_USER_TELEGRAM_ID,
          telegramName: "2AF1 Demo",
          firstName: "2AF1",
          lastName: "Guruh",
        },
      });
    } catch {
      // Race condition — another request created it
      demoUser = await db.user.findUnique({
        where: { telegramId: DEMO_USER_TELEGRAM_ID },
      });
    }
  }
  return demoUser?.id || null;
}
