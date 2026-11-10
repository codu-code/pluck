import { claimJob, enqueue, pendingJobCount } from "@pluck/db";
import { jobState, makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { runJobs } from "./jobs";
import { queueDueDigests } from "./library";

test("a job the platform keeps killing is failed after five tries, not retried forever", async () => {
  const { a } = await twoUsers();
  const id = await enqueue("extract", { userId: a, itemId: "000000000000000000000000" }); // would finish at once if it ran
  for (let i = 0; i < 5; i++) {
    expect((await claimJob(60_000))?.id).toBe(id); // claimed, then the function dies before it finishes
    await makeJobsVisible();
  }
  await runJobs({ budgetMs: 5_000 });
  expect(await jobState(id)).toEqual({ state: "failed", lastError: "did not finish in time" });
});

test("each due digest is its own job, sent by the worker", async () => {
  await twoUsers(); // no settings: Monday, 06:00 UTC
  expect(await queueDueDigests(new Date("2026-10-26T06:30:00Z"))).toBeGreaterThanOrEqual(2);
  expect(await queueDueDigests(new Date("2026-10-26T06:31:00Z"))).toBe(0); // claimed once
  expect(await pendingJobCount("digest")).toBeGreaterThanOrEqual(2);
  await runJobs({ budgetMs: 10_000 });
  expect(await pendingJobCount("digest")).toBe(0);
});

test("an email goes before the page reads queued ahead of it, and the rest are read side by side", async () => {
  const { a } = await twoUsers();
  const reads = [];
  for (let i = 0; i < 6; i++) reads.push(await enqueue("extract", { userId: a, itemId: "000000000000000000000000" }, { delayMs: -60_000 })); // queued a minute ago
  const email = await enqueue("digest", { userId: a });
  expect(await runJobs({ max: 1 })).toEqual({ ran: 1 });
  expect((await jobState(email))?.state).toBe("done");
  expect(await pendingJobCount("extract")).toBe(6);

  expect(await runJobs({ max: 5 })).toEqual({ ran: 5 }); // four loops share what is left to run, and no job runs twice
  expect(await runJobs()).toEqual({ ran: 1 });
  for (const id of reads) expect((await jobState(id))?.state).toBe("done");
});
