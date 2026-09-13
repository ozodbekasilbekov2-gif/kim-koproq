import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { getDemoUserId, ensureDemoSeed } from "@/lib/demo-seed";

// GET /api/results?setId=...
// Returns aggregated results for all questions in a set.
// Avatars are loaded from the set owner + demo user (so target avatars
// are always visible regardless of who's viewing).
// Voter info (name, photo) is returned so the UI can show who voted.
export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get("setId");
  if (!setId) return NextResponse.json({ error: "setId?" }, { status: 400 });

  // Ensure demo data exists (so demo avatars are available)
  try {
    await ensureDemoSeed();
  } catch (e) {
    console.error("[results] ensureDemoSeed failed:", e);
  }

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

  // Load avatars from ALL relevant owners: set owner + demo user + current user
  // This ensures target avatars are always found for display.
  const ownerIds = new Set<string>();
  ownerIds.add(set.ownerId); // the set's owner (has the questions + maybe avatars)
  const demoUserId = await getDemoUserId();
  if (demoUserId) ownerIds.add(demoUserId); // 27 demo 2AF1 members
  if (user) ownerIds.add(user.id); // current user's own avatars (if logged in)

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

  const votersSet = new Set(votes.map((v) => v.voterId));
  const totalMembers = avatars.length;
  const qCount = questions.length;

  // Completed voters: those who answered at least qCount distinct questions
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
    voterInfo, // { [voterId]: { name, photo } }
  });
}
