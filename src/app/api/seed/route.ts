import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { MEMBERS, SEED_QUESTIONS } from "@/lib/original-data";

// POST /api/seed — creates the original 2AF1 set with all 27 members and 32 questions
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    // 1) Create two groups: A and B (matching original)
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: user.id },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: user.id },
    });

    // 2) Create all 27 original members as avatars
    // Photos live in /public/static/members/<id>.jpg for those with photo=true
    const avatars: { id: string }[] = [];
    for (const m of MEMBERS) {
      const groupId = m.group === "A" ? groupA.id : groupB.id;
      const photoUrl = m.photo ? `/static/members/${m.id}.jpg` : null;
      const iconName = m.photo ? null : "user-secret"; // for mafia (no photo) members
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

    // 3) Create the demo set with original "Kim ko'proq...?" branding
    const set = await db.questionSet.create({
      data: {
        title: "Kim ko'proq...? — 2AF1 so'rovi",
        description: "2AF1 guruhi uchun qiziqarli savollar. Roast, Rostini ayt, Kelajak, Xaos.",
        emoji: "⚡",
        mode: "loose", // loose — har kim o'zgartira oladi
        ownerId: user.id,
        isPublic: true,
      },
    });

    // 4) Create all 32 original questions
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
