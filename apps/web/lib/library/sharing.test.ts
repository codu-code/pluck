import { hitRateLimit, pendingJobCount, pluckLink } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { browse, copyList, listsOf, newList, readList, setListVisibility, updateMe } from "./index";

const url = (i: number) => `https://example.com/copied/${i}`;
const skip = () => {}; // the rows and the queue are what count here, not reading the pages

// A public List of `count` links, every other one with a note.
async function publicListOf(owner: string, count: number) {
  const items = [];
  for (let i = 0; i < count; i++) items.push({ itemId: (await pluckLink(owner, { url: url(i), title: `Entry ${i}`, source: "web" })).item.id, note: i % 2 ? `Why ${i}` : null });
  const list = await newList(owner, { name: "Good reads", purpose: "All of them", items });
  await updateMe(owner, { handle: `owner-${Date.now().toString(36)}` });
  return setListVisibility(owner, list.id, "public");
}

test("Pluck this list: a copy of 30 entries has every one in order with its note, and every new Item is queued to be read", async () => {
  const { a, b } = await twoUsers();
  const theirs = await publicListOf(b, 30);
  const queued = await pendingJobCount("extract");
  const copy = await copyList(a, theirs.id, { defer: skip });
  expect(copy).toMatchObject({ name: "Good reads", purpose: "All of them", visibility: "private", itemCount: 30 });
  const { entries } = await readList(a, copy.id);
  expect(entries.map((e) => [e.item.url, e.note])).toEqual(Array.from({ length: 30 }, (_, i) => [url(i), i % 2 ? `Why ${i}` : null]));
  expect(entries.every((e) => e.item.source === "copied" && e.item.extraction.state === "pending")).toBe(true);
  expect(await pendingJobCount("extract")).toBe(queued + 30);
  expect((await readList(b, theirs.id)).entries).toHaveLength(30); // theirs is as it was
});

test("a copy cut off once its reads are queued has made no List yet, and every new Item is still queued", async () => {
  const { a, b } = await twoUsers();
  const theirs = await publicListOf(b, 3);
  const queued = await pendingJobCount("extract");
  const cutOff = () => {
    throw new Error("cut off");
  };
  await expect(copyList(a, theirs.id, { defer: cutOff })).rejects.toThrow("cut off");
  expect(await listsOf(a)).toEqual([]);
  expect(await pendingJobCount("extract")).toBe(queued + 3);
});

test("a copy spends the hourly links like a paste: one that would go over is refused and makes nothing", async () => {
  const { a, b } = await twoUsers();
  const theirs = await publicListOf(b, 30);
  await hitRateLimit(`links:${a}`, Infinity, 3600, 1990); // 1,990 of the hour's 2,000 spent
  await expect(copyList(a, theirs.id, { defer: skip })).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  expect(await listsOf(a)).toEqual([]);
  expect((await browse(a, { status: "inbox", sort: "newest", limit: 50 })).items).toEqual([]);
});
