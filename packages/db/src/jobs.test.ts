import { expect, test } from "vitest";
import { claimJob, completeJob, enqueue, failJob, hitRateLimit, pendingJobCount, retryJob } from "./index.ts";
import { jobState } from "./testing.ts";

test("a claimed job is leased, retried after its delay, and finished", async () => {
  const id = await enqueue("extract", { itemId: "x" });
  const job = await claimJob(60_000);
  expect(job).toMatchObject({ id, queue: "extract", attempts: 1 });
  expect(await claimJob()).toBeNull(); // leased

  expect(await retryJob(job!, "HTTP 503", 0)).toBe(true);
  const again = await claimJob();
  expect(again?.attempts).toBe(2);
  expect(await completeJob(again!)).toBe(true);
  expect(await pendingJobCount()).toBe(0);
});

test("delayed jobs wait; an expired lease makes a job claimable again", async () => {
  await enqueue("later", {}, { delayMs: 60_000 });
  expect(await claimJob()).toBeNull();
  const id = await enqueue("crashy", {});
  expect((await claimJob(1))?.id).toBe(id);
  await new Promise((r) => setTimeout(r, 10));
  const again = await claimJob();
  expect(again?.id).toBe(id);
  await failJob(again!, "gave up");
});

test("a runner whose lease ran out cannot finish, retry or fail the job another runner now holds", async () => {
  const id = await enqueue("crashy", {});
  const first = (await claimJob(1))!;
  await new Promise((r) => setTimeout(r, 10));
  const second = (await claimJob())!;
  expect(second.id).toBe(id);

  expect(await completeJob(first)).toBe(false);
  expect(await retryJob(first, "late", 0)).toBe(false);
  expect(await failJob(first, "late")).toBe(false);
  expect(await jobState(id)).toEqual({ state: "running", lastError: null });
  expect(await claimJob()).toBeNull(); // still the second runner's
  expect(await completeJob(second)).toBe(true);
  expect((await jobState(id))?.state).toBe("done");
});

test("an export or an import keeps a ten-minute lease, however it was claimed", async () => {
  const exportId = await enqueue("export", {});
  const anyQueue = (await claimJob(1))!;
  expect(anyQueue.id).toBe(exportId);
  await enqueue("import", {});
  const byQueue = (await claimJob(1, "import"))!;
  await new Promise((r) => setTimeout(r, 10));
  expect(await claimJob()).toBeNull(); // a 1 ms lease would have run out
  expect(await claimJob(1, "import")).toBeNull();
  await completeJob(anyQueue);
  await completeJob(byQueue);
});

test("rate limits count per key within a window", async () => {
  const key = `test:${Date.now()}`;
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await hitRateLimit(key, 3, 60));
  expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
  expect(results[3]!.retryAfter).toBeGreaterThan(0);
  expect((await hitRateLimit(`${key}:other`, 3, 60)).ok).toBe(true);
  expect((await hitRateLimit(`${key}:cost`, 3, 60, 3)).ok).toBe(true);
  expect((await hitRateLimit(`${key}:cost`, 3, 60)).ok).toBe(false); // one call spent the window
});
