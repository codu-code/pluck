import { claimJob, completeJob, failJob, retryJob, type Job } from "@pluck/db";
import { log } from "./log";

// The loop that runs queued jobs, apart from the handler table (jobs.ts) so the library can kick it without a cycle.
export type Handlers = Record<string, (payload: Record<string, unknown>) => Promise<void>>;
// By queue: told when a job has just failed for the last time, so what it was for is not left waiting on it.
export type GaveUp = Record<string, (payload: Record<string, unknown>, error: string) => Promise<unknown>>;

const MAX_ATTEMPTS = 5;

// A handler that throws is retried with backoff up to five times.
async function runOne(handlers: Handlers, job: Job, gaveUp?: GaveUp): Promise<void> {
  const started = Date.now();
  const fail = async (error: string) => {
    if (!(await failJob(job, error))) return; // another runner holds it now: what it was for is still being worked on
    await gaveUp?.[job.queue]?.(job.payload, error).catch((e: unknown) => log("error", "a failed job's record was not updated", { jobId: job.id, queue: job.queue, error: e }));
  };
  const handler = handlers[job.queue];
  if (!handler) return fail(`no handler for ${job.queue}`);
  // A job the platform killed mid-run never threw: its lease ran out and it came back. Stop after five of those.
  if (job.attempts > MAX_ATTEMPTS) return fail("did not finish in time");
  try {
    await handler(job.payload);
    const mine = await completeJob(job);
    log(mine ? "info" : "warn", mine ? "job done" : "job ran past its lease and another runner took it", { jobId: job.id, queue: job.queue, durationMs: Date.now() - started });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (job.attempts >= MAX_ATTEMPTS) await fail(error);
    else await retryJob(job, error, 30_000 * 2 ** (job.attempts - 1));
    log("warn", "job failed", { jobId: job.id, queue: job.queue, attempts: job.attempts, error });
  }
}

// Claims and runs jobs (of one queue, if named) until none are visible or the time budget is spent.
export async function runQueue(
  handlers: Handlers,
  { budgetMs = 45_000, max = 500, queue, gaveUp }: { budgetMs?: number; max?: number; queue?: string; gaveUp?: GaveUp } = {},
): Promise<{ ran: number }> {
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  while (ran < max && Date.now() < deadline) {
    const job = await claimJob(60_000, queue);
    if (!job) break;
    await runOne(handlers, job, gaveUp);
    ran++;
  }
  return { ran };
}
