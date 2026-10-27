import { getContent, pendingJobCount, pluckLink } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { runJobs } from "../jobs";
import { keepLater, keepNow, readItem } from "./index";

const FIX = "http://127.0.0.1:4180";
const link = async (userId: string, url: string) => (await pluckLink(userId, { url, source: "web" })).item;

test("kept now: the page's text is kept and nothing is queued", async () => {
  const { a } = await twoUsers();
  const item = await keepNow(a, await link(a, `${FIX}/news-1.html`), { timeoutMs: 5000 });
  expect(item.extraction).toMatchObject({ state: "done" });
  expect(item.title).toBe("Small teams ship when the list is short");
  expect((await getContent(a, item.id))?.textMarkdown).toContain("finishing problem");
  expect(await pendingJobCount("extract")).toBe(0);
});

test("kept later: the kick reads the queued pages after the response, and a failure there is retried", async () => {
  const { a } = await twoUsers();
  const item = await link(a, `${FIX}/flaky?n=later-${Date.now()}`);
  const deferred: (() => Promise<void>)[] = [];
  await keepLater(a, [item], { defer: (task) => void deferred.push(task) });
  expect(await pendingJobCount("extract")).toBe(1);
  for (const task of deferred) await task();
  expect((await readItem(a, item.id)).extraction).toEqual({ state: "pending", attempts: 1, lastError: "HTTP 503" });

  await makeJobsVisible();
  await runJobs({ budgetMs: 10_000 });
  const after = await readItem(a, item.id);
  expect(after.extraction.state).toBe("done");
  expect(after.title).toMatch(/^Back on its feet/);
  expect(await pendingJobCount()).toBe(0);
});

test("a page that keeps failing gets four tries, then the failure is final on the Item", async () => {
  const { a } = await twoUsers();
  let item = await keepNow(a, await link(a, `${FIX}/error?n=${Date.now()}`), { timeoutMs: 5000 });
  for (let i = 0; i < 3; i++) {
    expect(item.extraction).toEqual({ state: "pending", attempts: i + 1, lastError: "HTTP 500" });
    expect(await pendingJobCount("extract")).toBe(1);
    await makeJobsVisible();
    await runJobs({ budgetMs: 10_000 });
    item = await readItem(a, item.id);
  }
  expect(item.extraction).toEqual({ state: "failed", attempts: 4, lastError: "HTTP 500" });
  expect(await pendingJobCount()).toBe(0);
});

test("a 4xx is final at once", async () => {
  const { a } = await twoUsers();
  const item = await keepNow(a, await link(a, `${FIX}/missing-page.html`), { timeoutMs: 5000 });
  expect(item.extraction).toEqual({ state: "failed", attempts: 1, lastError: "HTTP 404" });
  expect(await pendingJobCount()).toBe(0);
});
