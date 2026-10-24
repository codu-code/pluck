import { rateLimits } from "./collections.ts";

// Fixed-window counter shared by every instance. Returns how long to wait when over the limit.
export async function hitRateLimit(key: string, max: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const doc = await (await rateLimits()).findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(windowStart + windowSec * 2000) } },
    { upsert: true, returnDocument: "after" },
  );
  const retryAfter = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
  return { ok: (doc?.count ?? 1) <= max, retryAfter };
}
