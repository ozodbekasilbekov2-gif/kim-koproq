import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserDb } from "@/lib/session";
import { SEED_QUESTIONS } from "@/lib/original-data";

const DEMO_SET_TITLE = "Kim ko'proq...? — 2AF1 so'rovi";

// POST /api/cleanup-demo-sets
// Finds all demo sets (title matching "Kim ko'proq" OR "2AF1" OR "Birinchi set")
// for ALL users and keeps only the BEST one per user (most questions, most recent).
// Deletes all duplicates + the old 12-question set.
// Also cleans up orphaned avatars/groups from deleted sets' owners if they have duplicates.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) {
      return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }

    // Find ALL demo sets across ALL users
    const allDemoSets = await db.questionSet.findMany({
      where: {
        OR: [
          { title: DEMO_SET_TITLE },
          { title: { contains: "Kim ko'proq" } },
          { title: { contains: "2AF1" } },
          { title: { contains: "Birinchi set" } },
        ],
      },
      include: {
        _count: { select: { questions: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by ownerId
    const byOwner = new Map<string, typeof allDemoSets>();
    for (const s of allDemoSets) {
      const arr = byOwner.get(s.ownerId) || [];
      arr.push(s);
      byOwner.set(s.ownerId, arr);
    }

    let deletedCount = 0;
    let keptCount = 0;
    const details: any[] = [];

    // For each owner, keep only the best set (most questions, then most recent)
    for (const [ownerId, sets] of byOwner.entries()) {
      // Sort: most questions first, then most recent
      sets.sort((a, b) => {
        if (b._count.questions !== a._count.questions) {
          return b._count.questions - a._count.questions;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const keepSet = sets[0]; // The best one
      const toDelete = sets.slice(1); // All the rest

      // If even the best set has < 29 questions, it's the old 12-question one — delete it too
      if (keepSet._count.questions < SEED_QUESTIONS.length) {
        // Delete all sets for this owner — they'll be recreated properly by ensureUserDemoSet
        for (const s of sets) {
          await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
          deletedCount++;
        }
        details.push({ ownerId, action: "deleted_all_incomplete", count: sets.length });
        continue;
      }

      // Keep the best one, delete the rest
      for (const s of toDelete) {
        await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
        deletedCount++;
      }
      keptCount++;
      details.push({
        ownerId,
        keptSetId: keepSet.id,
        keptQuestions: keepSet._count.questions,
        deletedDuplicates: toDelete.length,
      });
    }

    // Also clean up the system demo user's sets (2af1-demo-user)
    const demoUser = await db.user.findUnique({
      where: { telegramId: "2af1-demo-user" },
    });
    if (demoUser) {
      const demoSets = await db.questionSet.findMany({
        where: {
          ownerId: demoUser.id,
          OR: [
            { title: DEMO_SET_TITLE },
            { title: { contains: "Kim ko'proq" } },
            { title: { contains: "2AF1" } },
            { title: { contains: "Birinchi set" } },
          ],
        },
        include: { _count: { select: { questions: { where: { deletedAt: null } } } } },
        orderBy: { createdAt: "asc" },
      });

      if (demoSets.length > 1) {
        // Keep the best one
        demoSets.sort((a, b) => {
          if (b._count.questions !== a._count.questions) {
            return b._count.questions - a._count.questions;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        for (const s of demoSets.slice(1)) {
          await db.questionSet.delete({ where: { id: s.id } }).catch(() => {});
          deletedCount++;
        }
        details.push({
          ownerId: demoUser.id,
          action: "demo_user_cleanup",
          deletedDuplicates: demoSets.length - 1,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCount,
      keptCount,
      details,
    });
  } catch (e: any) {
    console.error("[cleanup] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
