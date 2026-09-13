import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "dev-secret-change-me-in-prod";

function base64UrlEncode(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function base64UrlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export async function signJwt(payload: Record<string, any>): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  // Add expiry: 7 days
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: Date.now(), exp }));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function verifyJwt<T = any>(token: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.warn("[jwt] token expired");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
