import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

// GET /api/results?setId=...
// Returns aggregated results for all questions in a set
export async function GET(req: NextRequest) {
  const user = await getCurrentUserDb(req);
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const setId = req.nextUrl.searchParams.get("setId");
  if (!setId) return NextResponse.json({ error: "setId?" }, { status: 400 });

  const set = await db.questionSet.findUnique({ where: { id: setId } });
  if (!set) return NextResponse.json({ error: "Set topilmadi" }, { status: 404 });
  if (!set.isPublic && set.ownerId !== user.id) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const questions = await db.question.findMany({
    where: { setId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const avatars = await db.avatar.findMany({
    where: { ownerId: user.id },
    include: { group: true },
  });
  const votes = await db.vote.findMany({
    where: { setId },
    include: { voter: { select: { id: true, firstName: true, lastName: true, telegramName: true, avatarUrl: true, telegramPhoto: true } } },
  });

  // Build results: { [questionId]: { [groupId]: { [targetId]: [voterIds] } } }
  const results: Record<string, Record<string, Record<string, string[]>>> = {};
  for (const v of votes) {
    const byG = (results[v.questionId] ||= {});
    const byT = (byG[v.groupId] ||= {});
    (byT[v.targetId] ||= []).push(v.voterId);
  }

  const votersSet = new Set(votes.map((v) => v.voterId));
  const totalMembers = avatars.length;
  const qCount = questions.length;

  // Completed voters: those who answered all questions for at least one of their group's required
  // For simplicity: completed = voters who have at least qCount distinct questionIds answered.
  const perVoter = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!perVoter.has(v.voterId)) perVoter.set(v.voterId, new Set());
    perVoter.get(v.voterId)!.add(v.questionId);
  }
  let completed = 0;
  for (const s of perVoter.values()) if (s.size >= qCount) completed++;

  return NextResponse.json({
    voters: votersSet.size,
    completed,
    totalMembers,
    results,
    questions,
    avatars,
  });
}
