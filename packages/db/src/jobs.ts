import { ObjectId } from "mongodb";
import { jobs, type JobDoc } from "./collections.ts";

// The Mongo-backed queue. A claimed job is invisible for its lease; if the worker dies, it reappears.
export type Job = { id: string; queue: string; payload: Record<string, unknown>; attempts: number };

export async function enqueue(queue: string, payload: Record<string, unknown>, { delayMs = 0 } = {}): Promise<string> {
  const now = new Date();
  const res = await (await jobs()).insertOne({
    _id: new ObjectId(), queue, payload, state: "queued", attempts: 0,
    visibleAt: new Date(now.getTime() + delayMs), lastError: null, createdAt: now, finishedAt: null,
  });
  return res.insertedId.toHexString();
}

export async function claimJob(leaseMs = 60_000): Promise<Job | null> {
  const now = new Date();
  const doc: JobDoc | null = await (await jobs()).findOneAndUpdate(
    { state: { $in: ["queued", "running"] }, visibleAt: { $lte: now } },
    { $set: { state: "running", visibleAt: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } },
    { sort: { visibleAt: 1 }, returnDocument: "after" },
  );
  return doc && { id: doc._id.toHexString(), queue: doc.queue, payload: doc.payload, attempts: doc.attempts };
}

export async function completeJob(id: string): Promise<void> {
  await (await jobs()).updateOne({ _id: new ObjectId(id) }, { $set: { state: "done", finishedAt: new Date() } });
}

export async function retryJob(id: string, error: string, delayMs: number): Promise<void> {
  await (await jobs()).updateOne(
    { _id: new ObjectId(id) },
    { $set: { state: "queued", lastError: error.slice(0, 500), visibleAt: new Date(Date.now() + delayMs) } },
  );
}

export async function failJob(id: string, error: string): Promise<void> {
  await (await jobs()).updateOne(
    { _id: new ObjectId(id) },
    { $set: { state: "failed", lastError: error.slice(0, 500), finishedAt: new Date() } },
  );
}

export async function pendingJobCount(queue?: string): Promise<number> {
  return (await jobs()).countDocuments({ state: { $in: ["queued", "running"] }, ...(queue ? { queue } : {}) });
}
