import { randomBytes } from "node:crypto";
import { db } from "./collections.ts";

// Links a visitor pasted on the home page before having an account, held for a day against a cookie token
// and moved into their library when they sign up. Never fetched while anonymous.
type TryDoc = { _id: string; urls: string[]; createdAt: Date; expireAt: Date };

const DAY_MS = 86_400_000;
export const MAX_HELD = 20;

const tries = async () => (await db()).collection<TryDoc>("tries");

// Adds links to the token's hold (or starts one). Returns the token and how many links it now holds.
export async function holdTry(token: string | null, urls: string[], now = new Date()): Promise<{ token: string; count: number }> {
  const id = token && /^[a-f0-9]{32}$/.test(token) ? token : randomBytes(16).toString("hex");
  const col = await tries();
  const current = (await col.findOne({ _id: id }))?.urls ?? [];
  const merged = [...new Set([...current, ...urls])].slice(0, MAX_HELD);
  await col.updateOne(
    { _id: id },
    { $set: { urls: merged, expireAt: new Date(now.getTime() + DAY_MS) }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  return { token: id, count: merged.length };
}

// Hands the held links over once and forgets them.
export async function takeTry(token: string): Promise<string[]> {
  if (!/^[a-f0-9]{32}$/.test(token)) return [];
  const doc = await (await tries()).findOneAndDelete({ _id: token, expireAt: { $gt: new Date() } });
  return doc?.urls ?? [];
}
