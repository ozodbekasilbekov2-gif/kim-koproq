import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

const SEED_QUESTIONS: { emoji: string; category: string; text: string }[] = [
  { emoji: "⏰", category: "Roast", text: "Kim \"5 minutda yetib kelaman\" deb, 1 soatdan keyin keladi?" },
  { emoji: "👻", category: "Roast", text: "Kim guruh chatida hammasini o'qiydi, lekin umrida javob yozmaydi?" },
  { emoji: "🤓", category: "Roast", text: "Kim domlaning har gapiga bosh qimirlatadi, lekin hech narsani tushunmaydi?" },
  { emoji: "🎭", category: "Roast", text: "Kim imtihondan oldin \"o'qimadim\" deydi, keyin eng yuqori ball oladi?" },
  { emoji: "🎤", category: "Roast", text: "Kim bir og'iz gap uchun 7 daqiqalik voice yuboradi?" },
  { emoji: "🧠", category: "Rostini ayt", text: "Kim aslida guruhning yashirin lideri?" },
  { emoji: "🛡️", category: "Rostini ayt", text: "Kimga hayotingni ishonib topshirarding?" },
  { emoji: "🤐", category: "Rostini ayt", text: "Kimga hech qachon sir aytmas eding?" },
  { emoji: "💍", category: "Kelajak", text: "Kim 30 yoshda ham \"hali erta\" deb uylanmaydi?" },
  { emoji: "🚗", category: "Kelajak", text: "Kim birinchi bo'lib mashina oladi?" },
  { emoji: "💰", category: "Xaos", text: "Kim butun guruhni 1 million dollarga sotadi?" },
  { emoji: "🧟", category: "Xaos", text: "Kim zombi apokalipsisida birinchi 5 minutda o'ladi?" },
];

// POST /api/seed — creates a demo set + avatars for the current user
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    // create two groups
    const groupA = await db.avatarGroup.create({
      data: { name: "A guruh", color: "A", ownerId: user.id },
    });
    const groupB = await db.avatarGroup.create({
      data: { name: "B guruh", color: "B", ownerId: user.id },
    });

    // create sample avatars (placeholders using professional icons)
    const avatarsData = [
      { name: "Ali", group: groupA, icon: "user" },
      { name: "Vali", group: groupA, icon: "user-tie" },
      { name: "Hasan", group: groupA, icon: "user-cog" },
      { name: "Husan", group: groupA, icon: "user-graduate" },
      { name: "Maryam", group: groupB, icon: "user-nurse" },
      { name: "Zaynab", group: groupB, icon: "user-check" },
      { name: "Saida", group: groupB, icon: "user-astronaut" },
    ];
    const avatars = [];
    for (const a of avatarsData) {
      avatars.push(
        await db.avatar.create({
          data: {
            name: a.name,
            iconName: a.icon,
            groupId: a.group.id,
            ownerId: user.id,
          },
        })
      );
    }

    // create a demo set
    const set = await db.questionSet.create({
      data: {
        title: "Birinchi set — Kim ko'proq?",
        description: "Telegram bot orqali sinab ko'ring",
        emoji: "⚡",
        mode: "loose",
        ownerId: user.id,
        isPublic: true,
      },
    });

    // seed questions
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
      set,
      groups: [groupA, groupB],
      avatars,
      questionsCount: SEED_QUESTIONS.length,
    });
  } catch (e: any) {
    console.error("[seed] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
