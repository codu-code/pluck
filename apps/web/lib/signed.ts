import { createHmac, timingSafeEqual } from "node:crypto";

// Signed one-tap links for the digest: no login, valid for 7 days, scoped to one person and one action.
export type Tap = { u: string; a: "keep" | "letgo" | "undo-letgo" | "stop" | "archive-all"; i?: string; e: number };

const secret = () => {
  const s = process.env.DIGEST_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("No secret for signed links");
  return s;
};
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function signTap(tap: Omit<Tap, "e">, ttlMs = 7 * 86_400_000, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...tap, e: now + ttlMs })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyTap(token: string, now = Date.now()): Tap | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const tap = JSON.parse(Buffer.from(body, "base64url").toString()) as Tap;
    return tap.e > now ? tap : null;
  } catch {
    return null;
  }
}
