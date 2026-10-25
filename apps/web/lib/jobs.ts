import { claimJob, completeJob, failJob, getItem, hitRateLimit, retryJob, type Job } from "@pluck/db";
import { extractAttempt } from "./capture";
import { finishFile, ingestInbound, runExport, runImport, sendDigest, sendWelcome } from "./library";
import { log } from "./log";

const MAX_ATTEMPTS = 5;
// Queued mail (Monday emails, welcomes) shares one send rate across every instance, under SES's 14 a second,
// so sign-in links (which skip the queue) always have room.
const QUEUED_MAIL_PER_SECOND = 8;
const mailSlot = async () => {
  while (!(await hitRateLimit("send:queued", QUEUED_MAIL_PER_SECOND, 1)).ok) await new Promise((r) => setTimeout(r, 250));
};

// Worker job handlers. A handler that throws is retried with backoff up to five times.
const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  async extract(p) {
    const userId = String(p.userId);
    const item = await getItem(userId, String(p.itemId));
    if (!item || item.extraction.state !== "pending") return; // done, failed, re-plucked or gone
    await extractAttempt(userId, item, { timeoutMs: 20_000 }); // records the attempt and queues the next one itself
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
  async file(p) {
    await finishFile(String(p.userId), String(p.itemId), String(p.key), String(p.contentType), String(p.name));
  },
  async export(p) {
    await runExport(String(p.userId), String(p.exportId));
  },
};

async function runOne(job: Job): Promise<void> {
  const started = Date.now();
  const handler = handlers[job.queue];
  if (!handler) return failJob(job.id, `no handler for ${job.queue}`);
  // A job the platform killed mid-run never threw: its lease ran out and it came back. Stop after five of those.
  if (job.attempts > MAX_ATTEMPTS) return failJob(job.id, "did not finish in time");
  try {
    await handler(job.payload);
    await completeJob(job.id);
    log("info", "job done", { jobId: job.id, queue: job.queue, durationMs: Date.now() - started });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (job.attempts >= MAX_ATTEMPTS) await failJob(job.id, error);
    else await retryJob(job.id, error, 30_000 * 2 ** (job.attempts - 1));
    log("warn", "job failed", { jobId: job.id, queue: job.queue, attempts: job.attempts, error });
  }
}

// Claims and runs jobs until none are visible or the time budget is spent. Used by the cron tick and the worker loop.
export async function runJobs({ budgetMs = 45_000, max = 500 } = {}): Promise<{ ran: number }> {
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  while (ran < max && Date.now() < deadline) {
    const job = await claimJob(60_000);
    if (!job) break;
    await runOne(job);
    ran++;
  }
  return { ran };
}
