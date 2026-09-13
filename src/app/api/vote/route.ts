import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

// body: { setId, questionId, targets: { [groupId]: avatarId|null } }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const body = await req.json();
    const setId = body.setId;
    const questionId = body.questionId;
    if (!setId || !questionId) return NextResponse.json({ error: "setId/questionId?" }, { status: 400 });
    const q = await db.question.findUnique({
      where: { id: questionId },
      include: { set: true },
    });
    if (!q || q.deletedAt || q.setId !== setId) {
      return NextResponse.json({ error: "Savol topilmadi" }, { status: 404 });
    }
    const targets: Record<string, string | null> = body.targets || {};
    for (const [groupId, avatarId] of Object.entries(targets)) {
      if (avatarId === null || avatarId === undefined || avatarId === "") {
        await db.vote.deleteMany({
          where: { voterId: user.id, questionId, groupId },
        });
        continue;
      }
      const avatar = await db.avatar.findUnique({ where: { id: avatarId as string } });
      if (!avatar) return NextResponse.json({ error: `Avatar topilmadi: ${avatarId}` }, { status: 400 });
      // Self-vote skip — compare against the user's selected avatar (selectedAvatarId)
      if (user.selectedAvatarId && avatar.id === user.selectedAvatarId) continue;
      await db.vote.upsert({
        where: {
          voterId_questionId_groupId: {
            voterId: user.id,
            questionId,
            groupId,
          },
        },
        create: {
          voterId: user.id,
          questionId,
          setId,
          targetId: avatarId as string,
          groupId,
        },
        update: { targetId: avatarId as string },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[vote] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET progress for current voter
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
  if (!user) return NextResponse.json({ answers: {} });
  const setId = req.nextUrl.searchParams.get("setId");
  if (!setId) return NextResponse.json({ answers: {} });
  const votes = await db.vote.findMany({
    where: { voterId: user.id, setId },
    select: { questionId: true, groupId: true, targetId: true },
  });
  const answers: Record<string, Record<string, string>> = {};
  for (const v of votes) {
    (answers[v.questionId] ||= {})[v.groupId] = v.targetId;
  }
  return NextResponse.json({ answers });
}
