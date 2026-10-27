import { claimOnce, narrowAiGrants, runDueExpiry } from "@pluck/db";
import { FIRST_PARTY_REDIRECTS } from "./auth";
import { announceNewPosts } from "./indexnow";
import { pollInbound, purgeBinNow, queueDueDigests, sortBackfill } from "./library";
import { log } from "./log";

// Time-based work, run from every cron tick and the worker loop. Each piece is claimed in the
// database, so however many instances call this, it happens once.
export async function runScheduled(now = new Date()): Promise<{ purged: number; expired: number; digests: number; inbound: number; sorted: number }> {
  if (await claimOnce("narrow-ai-grants-2026-10")) log("info", "old AI tool grants narrowed", { grants: await narrowAiGrants(FIRST_PARTY_REDIRECTS) });
  let purged = 0;
  if (await claimOnce(`purge-bin:${now.toISOString().slice(0, 10)}`)) {
    purged = await purgeBinNow();
    log("info", "bin purged", { purged });
  }
  const expiry = await runDueExpiry(now);
  for (const p of expiry.perUser) log("info", "expiry run", { userId: p.userId, archived: p.archived });
  const digests = await queueDueDigests(now);
  if (digests) log("info", "digests queued", { digests });
  const inbound = await pollInbound();
  const sorted = await sortBackfill(); // until every Item read before Previews has one; then a single lookup
  const announced = await announceNewPosts(now);
  if (announced) log("info", "new posts announced to IndexNow", { urls: announced });
  return { purged, expired: expiry.archived, digests, inbound, sorted };
}
