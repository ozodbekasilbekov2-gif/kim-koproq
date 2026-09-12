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
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: Date.now() }));
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
    return JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }
}
