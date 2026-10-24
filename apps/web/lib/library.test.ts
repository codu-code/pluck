import { getContent, getItemBlobKeys, pendingJobCount } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { runJobs } from "./jobs";
import { pluck, readItem } from "./library";

const FIX = "http://127.0.0.1:4180";

test("plucking a page keeps its text, its raw HTML and its cover", async () => {
  const { a } = await twoUsers();
  const { item, created } = await pluck(a, { url: `${FIX}/news-1.html?utm_source=newsletter` });
  expect(created).toBe(true);
  expect(item.url).toBe(`${FIX}/news-1.html`); // tracking stripped
  expect(item.title).toBe("Small teams ship when the list is short");
  expect(item.extraction.state).toBe("done");
  expect(item.siteName).toBe("The Example Times");
  expect((await getContent(a, item.id))?.textMarkdown).toContain("finishing problem");
  const keys = await getItemBlobKeys(a, item.id);
  expect(keys?.htmlKey).toMatch(/raw\.html$/);
  expect(keys?.coverKey).toMatch(/cover$/);
  expect((await readItem(a, item.id)).hasCover).toBe(true);
});

test("a 404 fails at once, with nothing queued", async () => {
  const { a } = await twoUsers();
  const { item } = await pluck(a, { url: `${FIX}/missing-page.html` });
  expect(item.extraction.state).toBe("failed");
  expect(item.extraction.lastError).toBe("HTTP 404");
  expect(await pendingJobCount("extract")).toBe(0);
});

test("a page that fails once is picked up by the retry queue", async () => {
  const { a } = await twoUsers();
  const url = `${FIX}/flaky?n=${Date.now()}`;
  const { item } = await pluck(a, { url });
  expect(item.extraction.state).toBe("pending");
  expect(item.extraction.lastError).toBe("HTTP 503");
  expect(await pendingJobCount("extract")).toBe(1);

  await makeJobsVisible();
  expect((await runJobs({ budgetMs: 10_000 })).ran).toBe(1);
  const after = await readItem(a, item.id);
  expect(after.extraction.state).toBe("done");
  expect(after.title).toMatch(/^Back on its feet/);
  expect(await pendingJobCount()).toBe(0);
});

test("a PDF link keeps its text and the file", async () => {
  const { a } = await twoUsers();
  const { item } = await pluck(a, { url: `${FIX}/doc.pdf` });
  expect(item.kind).toBe("pdf");
  expect(item.extraction.state).toBe("done");
  expect((await getContent(a, item.id))?.textMarkdown).toContain("Estimating for small builders");
});

test("not a link is a 400 with a sentence a person can read", async () => {
  const { a } = await twoUsers();
  await expect(pluck(a, { url: "javascript:alert(1)" })).rejects.toMatchObject({ status: 400, code: "bad_request" });
});
