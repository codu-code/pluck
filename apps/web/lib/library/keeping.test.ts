import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { applyExtraction, getContent, pendingJobCount, pluckLink } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test, vi } from "vitest";
import { runJobs } from "../jobs";
import { FetchError } from "@pluck/extract";
import { TooLarge, keys } from "@pluck/blob";
import { failureReason, keepLater, keepNow, readItem, sortBackfill } from "./index";

// The blob store as it is, with a note of each key and the type it was stored under.
const stored = vi.hoisted(() => [] as [key: string, contentType: string][]);
vi.mock("@pluck/blob", async (original) => {
  const blob = await original<typeof import("@pluck/blob")>();
  return { ...blob, putObject: (...args: Parameters<typeof blob.putObject>) => (stored.push([args[0], args[2]]), blob.putObject(...args)) };
});

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

test("a failure is reported as one of a few words, never its address or text", () => {
  expect(failureReason(new FetchError("https://secret.example/x returned 503", 503))).toBe("http_5xx");
  expect(failureReason(new FetchError("nope", 403))).toBe("http_denied");
  expect(failureReason(new FetchError("nope", 404))).toBe("http_4xx");
  expect(failureReason(new FetchError("blocked: private address"))).toBe("blocked");
  expect(failureReason(Object.assign(new Error("slow"), { name: "TimeoutError" }))).toBe("timeout");
  expect(failureReason(new TooLarge())).toBe("too_large");
  expect(failureReason("weird")).toBe("other");
});

test("the backfill's second read never replaces kept text with less of it", async () => {
  const { a } = await twoUsers();
  const item = await link(a, `${FIX}/news-1.html`);
  // As the extension kept it: a post with the transcript it read, far more words than the page gives a second read.
  const kept = { kind: "link" as const, preview: "post" as const, facts: {}, title: "t", siteName: null, author: null, excerpt: null, canonicalUrl: null, lang: null, wordCount: 100_000, markdown: "said in the video", extractor: "defuddle" };
  await applyExtraction(a, item.id, kept);
  for (let i = 0; i < 8; i++) await sortBackfill(); // every pass, to its end
  expect((await getContent(a, item.id))?.textMarkdown).toBe("said in the video");
  expect((await readItem(a, item.id)).wordCount).toBe(100_000);
});

test("a picture is stored under its own type, never the header the other server sent with it", async () => {
  const server = createServer((_, res) => res.writeHead(200, { "content-type": "image/PNG, text/html; charset=utf-8" }).end(Buffer.from("89504e470d0a1a0a", "hex"))).listen(0, "127.0.0.1");
  await once(server, "listening");
  const picture = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${Date.now()}.png`;
  try {
    const { a } = await twoUsers();
    const page = `<html><head><title>With a cover</title><meta property="og:image" content="${picture}"></head><body><p>Hello.</p></body></html>`;
    const withCover = await keepNow(a, await link(a, `https://example.com/with-a-cover-${Date.now()}`), { html: page, timeoutMs: 5000 });
    expect(stored).toContainEqual([keys.cover(a, withCover.id), "image/png"]);
    const image = await keepNow(a, await link(a, picture), { timeoutMs: 5000 }); // the link is the picture itself
    expect(stored).toContainEqual([keys.cover(a, image.id), "image/png"]);
  } finally {
    server.close();
  }
});
