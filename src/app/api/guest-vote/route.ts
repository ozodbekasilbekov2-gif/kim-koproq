import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Guest vote endpoint — saves anonymous votes to the database.
 *
 * POST /api/guest-vote
 * Body: {
 *   guestToken: string,  // anonymous identifier (localStorage per browser)
 *   guestName?: string,  // optional name
 *   setId: string,
 *   questionId: string,
 *   targets: { [groupId]: avatarId | null }  // null = remove vote
 * }
 *
 * No auth required — anyone with the set URL can vote.
 * The set must be public for votes to be accepted.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guestToken, guestName, setId, questionId, targets } = body;

    if (!guestToken || !setId || !questionId || !targets) {
      return NextResponse.json({ error: "guestToken, setId, questionId, targets kerak" }, { status: 400 });
    }

    // Verify the set exists and is public
    const set = await db.questionSet.findUnique({ where: { id: setId } });
    if (!set) return NextResponse.json({ error: "Set topilmadi" }, { status: 404 });
    if (!set.isPublic) {
      return NextResponse.json({ error: "Bu set shaxsiy — ovoz berib bo'lmaydi" }, { status: 403 });
    }

    // Verify the question exists in this set
    const question = await db.question.findUnique({
      where: { id: questionId },
    });
    if (!question || question.setId !== setId || question.deletedAt) {
      return NextResponse.json({ error: "Savol topilmadi" }, { status: 404 });
    }

    // Process each target (groupId → avatarId)
    for (const [groupId, avatarId] of Object.entries(targets as Record<string, string | null>)) {
      if (avatarId === null || avatarId === undefined || avatarId === "") {
        // Remove vote for this group
        await db.guestVote.deleteMany({
          where: { guestToken, questionId, groupId },
        });
        continue;
      }

      // Verify the avatar exists
      const avatar = await db.avatar.findUnique({ where: { id: avatarId as string } });
      if (!avatar) continue;

      // Skip self-votes (if guest selected an avatar as "me", they can't vote for themselves)
      // We check via the guest's selected avatar stored in localStorage
      // For simplicity, we just save the vote — self-vote check happens on the client

      // Upsert the vote
      await db.guestVote.upsert({
        where: {
          guestToken_questionId_groupId: {
            guestToken,
            questionId,
            groupId,
          },
        },
        create: {
          guestToken,
          guestName: guestName || null,
          questionId,
          setId,
          targetId: avatarId as string,
          groupId,
        },
        update: {
          targetId: avatarId as string,
          guestName: guestName || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[guest-vote] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * GET /api/guest-vote?setId=xxx&guestToken=yyy
 * Returns the guest's saved answers for a set.
 */
export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get("setId");
  const guestToken = req.nextUrl.searchParams.get("guestToken");
  if (!setId || !guestToken) {
    return NextResponse.json({ error: "setId va guestToken kerak" }, { status: 400 });
  }

  const guestVotes = await db.guestVote.findMany({
    where: { setId, guestToken },
    select: { questionId: true, groupId: true, targetId: true },
  });

  const answers: Record<string, Record<string, string>> = {};
  for (const v of guestVotes) {
    (answers[v.questionId] ||= {})[v.groupId] = v.targetId;
  }

  return NextResponse.json({ answers });
}
