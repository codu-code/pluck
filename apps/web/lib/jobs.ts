import { claimJob, completeJob, failJob, getItem, retryJob, type Job } from "@pluck/db";
import { extractAttempt } from "./capture";
import { log } from "./log";

// Worker job handlers. A handler that throws is retried with backoff up to five times.
const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  async extract(p) {
    const userId = String(p.userId);
    const item = await getItem(userId, String(p.itemId));
    if (!item || item.extraction.state !== "pending") return; // done, failed, re-plucked or gone
    await extractAttempt(userId, item, { timeoutMs: 20_000 }); // records the attempt and queues the next one itself
  },
};

async function runOne(job: Job): Promise<void> {
  const started = Date.now();
  const handler = handlers[job.queue];
  if (!handler) return failJob(job.id, `no handler for ${job.queue}`);
  try {
    await handler(job.payload);
    await completeJob(job.id);
    log("info", "job done", { jobId: job.id, queue: job.queue, durationMs: Date.now() - started });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (job.attempts >= 5) await failJob(job.id, error);
    else await retryJob(job.id, error, 30_000 * 2 ** (job.attempts - 1));
    log("warn", "job failed", { jobId: job.id, queue: job.queue, attempts: job.attempts, error });
  }
}

// Claims and runs jobs until none are visible or the time budget is spent. Used by the cron tick and the worker loop.
export async function runJobs({ budgetMs = 45_000, max = 50 } = {}): Promise<{ ran: number }> {
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
