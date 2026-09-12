import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyJwt } from "@/lib/jwt";

/**
 * Get current user from NextAuth session OR Telegram JWT (Authorization header).
 * Telegram JWT is used when the app is opened from Telegram Mini App (no NextAuth cookie).
 */
export async function getCurrentUserDb(req?: Request) {
  // Try Telegram JWT first (from Authorization header)
  if (req) {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice("Bearer ".length).trim();
      const payload = await verifyJwt<{ uid: string }>(token);
      if (payload?.uid) {
        const u = await db.user.findUnique({ where: { id: payload.uid } });
        if (u) return u;
      }
    }
  }
  // Fall back to NextAuth session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: (session.user as any).id } });
}

export async function requireUser(req?: Request) {
  const user = await getCurrentUserDb(req);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
