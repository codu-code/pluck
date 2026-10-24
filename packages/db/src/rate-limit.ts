import { rateLimits } from "./collections.ts";

// Fixed-window counter shared by every instance. Returns how long to wait when over the limit.
// `cost` spends several at once, for a request that does many things (one per link in a paste).
export async function hitRateLimit(key: string, max: number, windowSec: number, cost = 1): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const doc = await (await rateLimits()).findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: cost }, $setOnInsert: { expireAt: new Date(windowStart + windowSec * 2000) } },
    { upsert: true, returnDocument: "after" },
  );
  const retryAfter = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
  return { ok: (doc?.count ?? 1) <= max, retryAfter };
}
