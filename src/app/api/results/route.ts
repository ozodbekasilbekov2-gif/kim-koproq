import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";

// GET /api/results?setId=...
// Returns aggregated results for all questions in a set.
// Avatars are loaded from the set owner + demo user (so target avatars
// are always visible regardless of who's viewing).
// Voter info (name, photo) is returned so the UI can show who voted.
export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get("setId");
  if (!setId) return NextResponse.json({ error: "setId?" }, { status: 400 });

  const set = await db.questionSet.findUnique({ where: { id: setId } });
  if (!set) return NextResponse.json({ error: "Set topilmadi" }, { status: 404 });

  // Allow access for public sets (guests), require auth for private sets
  const user = await getCurrentUserDb(req);
  if (!set.isPublic && (!user || set.ownerId !== user.id)) {
    return NextResponse.json({ error: "Ruxsat yo'q — bu set shaxsiy" }, { status: 403 });
  }

  const questions = await db.question.findMany({
    where: { setId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // Load avatars from the SET'S OWNER only.
  // Each user has their OWN 27 demo avatars, so we load from whoever owns
  // this set — that's whose results we're showing.
  // (Plus the current user if they're logged in and viewing someone else's set)
  const ownerIds = new Set<string>();
  ownerIds.add(set.ownerId); // the set's owner (has the questions + avatars)
  if (user && user.id !== set.ownerId) {
    ownerIds.add(user.id); // current user's own avatars (if viewing someone else's set)
  }

  const avatars = await db.avatar.findMany({
    where: { ownerId: { in: Array.from(ownerIds) } },
    include: { group: true },
  });

  // Load votes with voter info
  const votes = await db.vote.findMany({
    where: { setId },
    include: {
      voter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramName: true,
          email: true,
          avatarUrl: true,
          telegramPhoto: true,
        },
      },
    },
  });

  // Build results: { [questionId]: { [groupId]: { [targetId]: [voterIds] } } }
  const results: Record<string, Record<string, Record<string, string[]>>> = {};
  // voterInfo: { [voterId]: { name, photo } } — for UI display
  const voterInfo: Record<string, { name: string; photo: string | null }> = {};
  for (const v of votes) {
    const byG = (results[v.questionId] ||= {});
    const byT = (byG[v.groupId] ||= {});
    (byT[v.targetId] ||= []).push(v.voterId);

    // Build voter info (deduplicated)
    if (!voterInfo[v.voterId]) {
      const name =
        [v.voter.firstName, v.voter.lastName].filter(Boolean).join(" ") ||
        v.voter.telegramName ||
        v.voter.email ||
        "Foydalanuvchi";
      const photo = v.voter.avatarUrl || v.voter.telegramPhoto || null;
      voterInfo[v.voterId] = { name, photo };
    }
  }

  // Also load guest votes (anonymous, from share-link users)
  const guestVotes = await db.guestVote.findMany({
    where: { setId },
    select: {
      guestToken: true,
      guestName: true,
      questionId: true,
      groupId: true,
      targetId: true,
    },
  });

  // Merge guest votes into results
  for (const gv of guestVotes) {
    const byG = (results[gv.questionId] ||= {});
    const byT = (byG[gv.groupId] ||= {});
    // Use a guest-prefixed ID to distinguish from registered users
    const guestVoterId = `guest:${gv.guestToken}`;
    (byT[gv.targetId] ||= []).push(guestVoterId);

    // Build guest voter info
    if (!voterInfo[guestVoterId]) {
      voterInfo[guestVoterId] = {
        name: gv.guestName || "Mehmon",
        photo: null, // guests don't have photos
      };
    }
  }

  const votersSet = new Set([
    ...votes.map((v) => v.voterId),
    ...guestVotes.map((gv) => `guest:${gv.guestToken}`),
  ]);
  const totalMembers = avatars.length;
  const qCount = questions.length;

  // Completed voters: those who answered at least qCount distinct questions
  const perVoter = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!perVoter.has(v.voterId)) perVoter.set(v.voterId, new Set());
    perVoter.get(v.voterId)!.add(v.questionId);
  }
  // Also count guest votes
  for (const gv of guestVotes) {
    const guestVoterId = `guest:${gv.guestToken}`;
    if (!perVoter.has(guestVoterId)) perVoter.set(guestVoterId, new Set());
    perVoter.get(guestVoterId)!.add(gv.questionId);
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
    voterInfo, // { [voterId]: { name, photo } }
  });
}
