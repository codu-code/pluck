import { hitRateLimit } from "@pluck/db";
import { ApiError, json, route } from "@/lib/api";
import { sendDigest } from "@/lib/library";

// "Send me one now" from Settings: the digest as it would look today, whatever the day. Five a day: each is an email
// we pay for, and a key could otherwise send thousands.
export const POST = route({ kind: "write" }, async ({ caller }) => {
  const r = await hitRateLimit(`digest-send:${caller.userId}`, 5, 24 * 60 * 60);
  if (!r.ok) throw new ApiError("rate_limited", "That's five today. Try again tomorrow.", 429, { retryAfter: r.retryAfter });
  return json({ sent: await sendDigest(caller.userId, { force: true }) });
});
