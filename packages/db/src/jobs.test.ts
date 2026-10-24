import { expect, test } from "vitest";
import { claimJob, completeJob, enqueue, failJob, hitRateLimit, pendingJobCount, retryJob } from "./index.ts";

test("a claimed job is leased, retried after its delay, and finished", async () => {
  const id = await enqueue("extract", { itemId: "x" });
  const job = await claimJob(60_000);
  expect(job).toMatchObject({ id, queue: "extract", attempts: 1 });
  expect(await claimJob()).toBeNull(); // leased

  await retryJob(id, "HTTP 503", 0);
  expect((await claimJob())?.attempts).toBe(2);
  await completeJob(id);
  expect(await pendingJobCount()).toBe(0);
});

test("delayed jobs wait; an expired lease makes a job claimable again", async () => {
  await enqueue("later", {}, { delayMs: 60_000 });
  expect(await claimJob()).toBeNull();
  const id = await enqueue("crashy", {});
  expect((await claimJob(1))?.id).toBe(id);
  await new Promise((r) => setTimeout(r, 10));
  expect((await claimJob())?.id).toBe(id);
  await failJob(id, "gave up");
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
