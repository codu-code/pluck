import { ObjectId } from "mongodb";
import { jobs, type JobDoc } from "./collections.ts";

// The Mongo-backed queue. A claimed job is invisible for its lease; if the worker dies, it reappears.
// `lease` is when this claim runs out, and it is the claim's name: finishing, retrying or failing a job only works
// for the runner whose claim is still the job's latest, so one that ran past its lease cannot touch the job another
// runner has since taken. Nothing new is stored: it is the job's own `visibleAt`.
export type Job = { id: string; queue: string; payload: Record<string, unknown>; attempts: number; lease: Date };

// A whole library zipped, an import file of hundreds of megabytes parsed: these outlast a minute on a worker that is
// never cut off, and at a one-minute lease a second runner sent the export email again or forked the import.
// shortcut: a lease is not renewed, so a run over ten minutes is still handed out twice, and one the platform killed waits ten minutes for its next try; renew the lease from the handler if either shows up.
const LONG_QUEUES = ["export", "import"];
const LONG_LEASE_MS = 600_000;

export async function enqueue(queue: string, payload: Record<string, unknown>, { delayMs = 0 } = {}): Promise<string> {
  const now = new Date();
  const res = await (await jobs()).insertOne({
    _id: new ObjectId(), queue, payload, state: "queued", attempts: 0,
    visibleAt: new Date(now.getTime() + delayMs), lastError: null, createdAt: now, finishedAt: null,
  });
  return res.insertedId.toHexString();
}

export async function claimJob(leaseMs = 60_000, queue?: string): Promise<Job | null> {
  const now = Date.now();
  // A pipeline, so the lease can depend on the queue of whichever job is claimed.
  const doc: JobDoc | null = await (await jobs()).findOneAndUpdate(
    { state: { $in: ["queued", "running"] }, visibleAt: { $lte: new Date(now) }, ...(queue && { queue }) },
    [{ $set: {
      state: "running", attempts: { $add: ["$attempts", 1] },
      visibleAt: { $cond: [{ $in: ["$queue", LONG_QUEUES] }, new Date(now + Math.max(leaseMs, LONG_LEASE_MS)), new Date(now + leaseMs)] },
    } }],
    { sort: { visibleAt: 1 }, returnDocument: "after" },
  );
  return doc && { id: doc._id.toHexString(), queue: doc.queue, payload: doc.payload, attempts: doc.attempts, lease: doc.visibleAt };
}

// The job as this claim left it. False from the three below means another runner holds it now, and nothing was changed.
const held = (job: Pick<Job, "id" | "lease">) => ({ _id: new ObjectId(job.id), state: "running" as const, visibleAt: job.lease });

export async function completeJob(job: Pick<Job, "id" | "lease">): Promise<boolean> {
  return (await (await jobs()).updateOne(held(job), { $set: { state: "done", finishedAt: new Date() } })).modifiedCount > 0;
}

export async function retryJob(job: Pick<Job, "id" | "lease">, error: string, delayMs: number): Promise<boolean> {
  const res = await (await jobs()).updateOne(
    held(job),
    { $set: { state: "queued", lastError: error.slice(0, 500), visibleAt: new Date(Date.now() + delayMs) } },
  );
  return res.modifiedCount > 0;
}

export async function failJob(job: Pick<Job, "id" | "lease">, error: string): Promise<boolean> {
  const res = await (await jobs()).updateOne(
    held(job),
    { $set: { state: "failed", lastError: error.slice(0, 500), finishedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

export async function pendingJobCount(queue?: string): Promise<number> {
  return (await jobs()).countDocuments({ state: { $in: ["queued", "running"] }, ...(queue ? { queue } : {}) });
}
