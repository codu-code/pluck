import { rateLimits } from "./collections.ts";

// Fixed-window counter shared by every instance. Returns how long to wait when over the limit.
// `cost` spends several at once, for a request that does many things (one per link in a paste).
export async function hitRateLimit(key: string, max: number, windowSec: number, cost = 1): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const col = await rateLimits();
  const _id = `${key}:${windowStart}`;
  const doc = await col.findOneAndUpdate(
    { _id },
    { $inc: { count: cost }, $setOnInsert: { expireAt: new Date(windowStart + windowSec * 2000) } },
    { upsert: true, returnDocument: "after" },
  );
  const ok = (doc?.count ?? 1) <= max;
  // A refused request for several gives them back, so a paste that does not fit leaves room for the single ones that do.
  // (A refused request for one keeps its one: the window is full either way, and it saves the write.)
  if (!ok && cost > 1) await col.updateOne({ _id }, { $inc: { count: -cost } });
  const retryAfter = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
  return { ok, retryAfter };
}
