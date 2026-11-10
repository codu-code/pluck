import { finishExport, hitRateLimit, latestExport, updateImport } from "@pluck/db";
import { runQueue, type GaveUp, type Handlers } from "./job-runner";
import { ingestInbound, keepFile, keepGaveUp, keepQueued, runExport, runImport, sendDigest, sendWelcome } from "./library";

// Queued mail (Monday emails, welcomes) shares one send rate across every instance, under SES's 14 a second,
// so sign-in links (which skip the queue) always have room.
const QUEUED_MAIL_PER_SECOND = 8;
const mailSlot = async () => {
  while (!(await hitRateLimit("send:queued", QUEUED_MAIL_PER_SECOND, 1)).ok) await new Promise((r) => setTimeout(r, 250));
};

// Worker job handlers, by queue. Keeping a page has its own retry policy (library/keeping.ts).
const handlers: Handlers = {
  async extract(p) {
    await keepQueued(String(p.userId), String(p.itemId));
  },
  async file(p) {
    await keepFile(String(p.userId), String(p.itemId), String(p.key), String(p.contentType), String(p.name));
  },
  async digest(p) {
    await mailSlot();
    await sendDigest(String(p.userId));
  },
  async welcome(p) {
    await mailSlot();
    await sendWelcome(String(p.userId));
  },
  async "email-in"(p) {
    await ingestInbound(String(p.key));
  },
  async import(p) {
    await runImport(String(p.userId), String(p.importId));
  },
  async export(p) {
    await runExport(String(p.userId), String(p.exportId));
  },
};

// A job that has just failed for the last time tells what it was for, so nothing reads as running or pending for ever.
// A page that could not be fetched is not one of these: keeping.ts records that on the Item, try by try.
const gaveUp: GaveUp = {
  extract: (p, error) => keepGaveUp(String(p.userId), String(p.itemId), error),
  file: (p, error) => keepGaveUp(String(p.userId), String(p.itemId), error),
  // Shown in Settings as it is, like the import's other two errors (library/account.ts).
  import: (p) => updateImport(String(p.importId), { state: "failed", error: "This import stopped before it finished. Import the file again: what is already in your library is left as it is." }),
  async export(p) {
    const latest = await latestExport(String(p.userId));
    if (latest?.id === String(p.exportId) && latest.state === "running") await finishExport(latest.id, null); // one whose zip was made keeps it
  },
};

// Everything but reading pages. The two that can run long (Monday's emails at the send rate, an import that queues its
// own next batch) go last.
// shortcut: claiming from one queue reads past every waiting job of the others (the index is state and visibleAt); put `queue` in the jobs index once tens of thousands wait.
const QUICK = ["email-in", "file", "export", "welcome", "digest", "import"];
const LOOPS = 4;

// Used by the cron tick and the worker loop. A big import or a slow site can fill the queue with `extract` jobs, so the
// quick queues go first, for up to half the time (they must not hold page reads back in turn); then four loops side by
// side take whatever is oldest. claimJob gives a job to one loop only.
// shortcut: inside `extract` it is still first come, first served, so one person's 20,000 links go ahead of the next person's one; claiming per person in turn (round-robin) is the upgrade.
export async function runJobs({ budgetMs = 45_000, max = 500 }: { budgetMs?: number; max?: number } = {}): Promise<{ ran: number }> {
  const started = Date.now();
  let ran = 0;
  for (const queue of QUICK) ran += (await runQueue(handlers, { gaveUp, queue, max: max - ran, budgetMs: started + budgetMs / 2 - Date.now() })).ran;
  const left = max - ran;
  const loops = await Promise.all(
    Array.from({ length: LOOPS }, (_, i) => runQueue(handlers, { gaveUp, max: Math.floor(left / LOOPS) + (i < left % LOOPS ? 1 : 0), budgetMs: started + budgetMs - Date.now() })),
  );
  return { ran: loops.reduce((n, l) => n + l.ran, ran) };
}
