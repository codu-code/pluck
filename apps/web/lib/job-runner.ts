import { claimJob, completeJob, failJob, retryJob, type Job } from "@pluck/db";
import { log } from "./log";

// The loop that runs queued jobs, apart from the handler table (jobs.ts) so the library can kick it without a cycle.
export type Handlers = Record<string, (payload: Record<string, unknown>) => Promise<void>>;

const MAX_ATTEMPTS = 5;

// A handler that throws is retried with backoff up to five times.
async function runOne(handlers: Handlers, job: Job): Promise<void> {
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

// Claims and runs jobs (of one queue, if named) until none are visible or the time budget is spent.
export async function runQueue(handlers: Handlers, { budgetMs = 45_000, max = 500, queue }: { budgetMs?: number; max?: number; queue?: string } = {}): Promise<{ ran: number }> {
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  while (ran < max && Date.now() < deadline) {
    const job = await claimJob(60_000, queue);
    if (!job) break;
    await runOne(handlers, job);
    ran++;
  }
  return { ran };
}
