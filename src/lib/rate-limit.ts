// Simple in-memory rate limiter (no Redis needed).
// Tracks requests per IP per window. For Vercel serverless, this is per-instance
// (not shared across invocations), but it still helps against basic abuse.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS: Record<string, number> = {
  register: 3,       // 3 registrations per minute per IP
  "telegram-auth": 5, // 5 Telegram logins per minute
  vote: 30,           // 30 votes per minute
  "guest-vote": 30,   // 30 guest votes per minute
};

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  identifier: string,
  ip: string,
  limitName: keyof typeof MAX_REQUESTS | string
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = MAX_REQUESTS[limitName] ?? 30;
  const key = `${limitName}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;

  // Clean up old entries periodically
  if (store.size > 1000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
