import { getContent, getItemBlobKeys, pendingJobCount } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { runJobs } from "./jobs";
import { pluck, pluckAny, readItem, readText, updateItem } from "./library";

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

test("a block of text with links makes one item per link and reads them all", async () => {
  const { a } = await twoUsers();
  const text = `Two for later: ${FIX}/news-3.html and ${FIX}/blog-1.html, plus ${FIX}/news-3.html?utm_source=dup and javascript:void(0)`;
  const res = await pluckAny(a, { text });
  expect(res.results).toHaveLength(2);
  expect(res.rejected).toHaveLength(0);
  const titles = await Promise.all(res.results.map(async (r) => (await readItem(a, r.item.id)).title));
  expect(titles).toEqual(["Free services need honest rate limits", "Notes on reading code for the first time"]);
});

test("urls[] reports the ones it cannot open", async () => {
  const { a } = await twoUsers();
  const res = await pluckAny(a, { urls: [`${FIX}/news-4.html`, "not a link", `${FIX}/docs-2.html`] });
  expect(res.results).toHaveLength(2);
  expect(res.rejected).toEqual([{ input: "not a link", message: "That is not a link Pluck can open." }]);
});

test("text without links is a note; with a kind it is a todo or a thing with a due date", async () => {
  const { a } = await twoUsers();
  const note = (await pluckAny(a, { text: "Measure the worktop cut-out twice." })).results[0]!.item;
  expect(note).toMatchObject({ kind: "note", title: "Measure the worktop cut-out twice.", url: null });
  const todo = (await pluckAny(a, { text: "Outline the November talk", kind: "todo", dueAt: "2026-11-03T09:00:00.000Z" })).results[0]!.item;
  expect(todo).toMatchObject({ kind: "todo", dueAt: "2026-11-03T09:00:00.000Z" });
  // A todo whose text has a link in it stays a todo.
  const thing = (await pluckAny(a, { text: `Induction hob ${FIX}/news-1.html`, kind: "thing" })).results[0]!.item;
  expect(thing.kind).toBe("thing");
});

test("edits follow the rules for links and notes", async () => {
  const { a } = await twoUsers();
  const note = (await pluckAny(a, { text: "First\nbody" })).results[0]!.item;
  expect((await updateItem(a, note.id, { text: "Second\nbody" })).title).toBe("Second");
  expect(await readText(a, note.id)).toBe("Second\nbody");
  expect((await updateItem(a, note.id, { kind: "thing" })).kind).toBe("thing");
  await expect(updateItem(a, note.id, { kind: "video" })).rejects.toMatchObject({ status: 400 });

  const link = (await pluckAny(a, { url: `${FIX}/blog-2.html` })).results[0]!.item;
  await expect(updateItem(a, link.id, { text: "nope" })).rejects.toMatchObject({ status: 400 });
  await expect(updateItem(a, link.id, { kind: "note" })).rejects.toMatchObject({ status: 400 });
  expect((await updateItem(a, link.id, { kind: "video" })).kind).toBe("video");
});
