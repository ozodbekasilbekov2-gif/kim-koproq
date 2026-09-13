import { db } from "@/lib/db";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

const DEMO_SET_TITLE = "Kim ko'proq...? — 2AF1 so'rovi";

/**
 * Ensures a user has their OWN personal demo set with 27 avatars and 29 questions.
 * Each user gets their own copy — so votes and results are per-user.
 *
 * This is called ONLY:
 * - On registration (POST /api/register)
 * - On Telegram auth (POST /api/telegram/auth)
 *
 * NOT called on every /api/sets, /api/avatars, /api/groups request — those just READ.
 *
 * Race-condition-safe: uses findFirst with orderBy to always pick the latest,
 * and only creates if NONE exists with >=29 questions.
 */
export async function ensureUserDemoSet(userId: string): Promise<void> {
  if (!userId) return;

  // 1) Check if the user already has a "good" demo set (>=29 questions)
  const existingSets = await db.questionSet.findMany({
    where: { ownerId: userId, title: DEMO_SET_TITLE },
    include: { _count: { select: { questions: { where: { deletedAt: null } } } } },
    orderBy: { createdAt: "desc" },
  });

  // Find the best one (most questions)
  const bestSet = existingSets.length > 0
    ? existingSets.reduce((best, s) =>
        s._count.questions > best._count.questions ? s : best
      )
    : null;

  if (bestSet && bestSet._count.questions >= SEED_QUESTIONS.length) {
    // Good set exists — delete any duplicates
    if (existingSets.length > 1) {
      for (const s of existingSets) {
        if (s.id !== bestSet.id) {
          await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
      console.log(`[ensureUserDemoSet] Cleaned up ${existingSets.length - 1} duplicate sets for user ${userId}`);
    }
    return; // Good set exists, duplicates cleaned
  }

  // 2) Delete ALL existing demo sets for this user (they're incomplete)
  for (const s of existingSets) {
    await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
  }

  // 3) Ensure groups A and B exist (create only if missing)
  let groups = await db.avatarGroup.findMany({ where: { ownerId: userId } });
  let groupA = groups.find((g) => g.color === "A");
  let groupB = groups.find((g) => g.color === "B");

  if (!groupA) {
    groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: userId },
    });
  }
  if (!groupB) {
    groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: userId },
    });
  }

  // 4) Ensure the 27 demo avatars exist (create only missing ones, don't delete custom)
  const existingAvatars = await db.avatar.findMany({
    where: { ownerId: userId },
    select: { name: true },
  });
  const existingAvatarNames = new Set(existingAvatars.map((a) => a.name));

  for (const m of MEMBERS) {
    if (existingAvatarNames.has(m.name)) continue;

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
        ownerId: userId,
      },
    });
  }

  // 5) Create the demo set (only one!)
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

  // 6) Create all 29 questions
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
  console.log(`[ensureUserDemoSet] Created demo set with ${SEED_QUESTIONS.length} questions for user ${userId}`);
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
