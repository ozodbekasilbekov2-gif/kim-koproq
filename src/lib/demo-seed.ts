import { db } from "@/lib/db";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

const DEMO_SET_TITLE = "Kim ko'proq...? — 2AF1 so'rovi";

/**
 * Ensures a user has their OWN personal demo set with 27 avatars and 29 questions.
 * Each user gets their own copy — so votes and results are per-user.
 *
 * This is called:
 * - On registration (POST /api/register)
 * - On /api/sets GET (if user is logged in but has no demo set)
 *
 * Idempotent: if the user already has a demo set with >=29 questions and
 * >=27 avatars, returns immediately.
 */
export async function ensureUserDemoSet(userId: string): Promise<void> {
  if (!userId) return;

  // 1) Check if the user already has a "good" demo set
  const existingSet = await db.questionSet.findFirst({
    where: { ownerId: userId, title: DEMO_SET_TITLE },
    include: { _count: { select: { questions: true } } },
  });

  if (existingSet && existingSet._count.questions >= SEED_QUESTIONS.length) {
    // Verify the user also has 27 avatars
    const avatarCount = await db.avatar.count({ where: { ownerId: userId } });
    if (avatarCount >= MEMBERS.length) {
      return; // Everything is in place — nothing to do
    }
  }

  // 2) Check if the user has avatars — if not, create them
  const existingAvatarCount = await db.avatar.count({ where: { ownerId: userId } });

  let groupAId: string | null = null;
  let groupBId: string | null = null;

  if (existingAvatarCount < MEMBERS.length) {
    // Clean up any partial data
    await db.avatar.deleteMany({ where: { ownerId: userId } }).catch(() => {});
    await db.avatarGroup.deleteMany({ where: { ownerId: userId } }).catch(() => {});

    // Create groups A and B
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: userId },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: userId },
    });
    groupAId = groupA.id;
    groupBId = groupB.id;

    // Create all 27 avatars
    for (const m of MEMBERS) {
      const groupId = m.group === "A" ? groupAId : groupBId;
      const photoUrl = m.photo ? `/static/members/${m.id}.jpg` : null;
      const iconName = m.photo ? null : "user-secret";
      await db.avatar.create({
        data: {
          name: m.name,
          shortName: m.short,
          photoUrl,
          iconName,
          groupId,
          ownerId: userId,
        },
      });
    }
    console.log(`[ensureUserDemoSet] Created ${MEMBERS.length} avatars for user ${userId}`);
  } else {
    // User already has avatars — find the group IDs
    const groups = await db.avatarGroup.findMany({ where: { ownerId: userId } });
    groupAId = groups.find((g) => g.color === "A")?.id || groups[0]?.id || null;
    groupBId = groups.find((g) => g.color === "B")?.id || groups[1]?.id || null;
  }

  // 3) Create the demo set if it doesn't exist or is incomplete
  if (!existingSet || existingSet._count.questions < SEED_QUESTIONS.length) {
    // Delete old incomplete demo sets for this user
    const staleSets = await db.questionSet.findMany({
      where: { ownerId: userId, title: DEMO_SET_TITLE },
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
        ownerId: userId,
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
          createdBy: userId,
        },
      });
    }
    console.log(
      `[ensureUserDemoSet] Created demo set "${DEMO_SET_TITLE}" with ${SEED_QUESTIONS.length} questions for user ${userId}`
    );
  }
}

/**
 * Legacy function — kept for backward compatibility with the bot.
 * The bot uses getDefaultSet() which finds the first public set.
 * We keep ensureDemoSeed() for the bot only — it creates ONE shared demo
 * set owned by the system '2af1-demo-user' so the bot has something to work with.
 *
 * The website no longer uses this — each user gets their own personal demo set
 * via ensureUserDemoSet().
 */
export async function ensureDemoSeed(): Promise<void> {
  const DEMO_USER_TELEGRAM_ID = "2af1-demo-user";

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
      demoUser = await db.user.findUnique({
        where: { telegramId: DEMO_USER_TELEGRAM_ID },
      });
      if (!demoUser) return;
    }
  }

  // Check if demo user has 27 avatars
  const avatarCount = await db.avatar.count({
    where: { ownerId: demoUser.id },
  });

  if (avatarCount < MEMBERS.length) {
    await db.avatar.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});
    await db.avatarGroup.deleteMany({ where: { ownerId: demoUser.id } }).catch(() => {});

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
  }

  const existingSet = await db.questionSet.findFirst({
    where: { title: DEMO_SET_TITLE, ownerId: demoUser.id },
    include: { _count: { select: { questions: true } } },
  });

  if (!existingSet || existingSet._count.questions < SEED_QUESTIONS.length) {
    const staleSets = await db.questionSet.findMany({
      where: {
        ownerId: demoUser.id,
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
  }
}

export async function getDemoUserId(): Promise<string | null> {
  let demoUser = await db.user.findUnique({
    where: { telegramId: "2af1-demo-user" },
  });
  if (!demoUser) {
    try {
      demoUser = await db.user.create({
        data: {
          telegramId: "2af1-demo-user",
          telegramName: "2AF1 Demo",
          firstName: "2AF1",
          lastName: "Guruh",
        },
      });
    } catch {
      demoUser = await db.user.findUnique({
        where: { telegramId: "2af1-demo-user" },
      });
    }
  }
  return demoUser?.id || null;
}
