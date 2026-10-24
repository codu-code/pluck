import { claimOnce, runDueExpiry } from "@pluck/db";
import { pollInbound, purgeBinNow, sendDueDigests } from "./library";
import { log } from "./log";

// Time-based work, run from every cron tick and the worker loop. Each piece is claimed in the
// database, so however many instances call this, it happens once.
export async function runScheduled(now = new Date()): Promise<{ purged: number; expired: number; digests: number; inbound: number }> {
  let purged = 0;
  if (await claimOnce(`purge-bin:${now.toISOString().slice(0, 10)}`)) {
    purged = await purgeBinNow();
    log("info", "bin purged", { purged });
  }
  const expiry = await runDueExpiry(now);
  for (const p of expiry.perUser) log("info", "expiry run", { userId: p.userId, archived: p.archived });
  const digests = await sendDueDigests(now);
  if (digests) log("info", "digests sent", { digests });
  const inbound = await pollInbound();
  return { purged, expired: expiry.archived, digests, inbound };
}
