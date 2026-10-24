import { describe, expect, test } from "vitest";
import {
  applyExtraction, getContent, getItem, getItemBlobKeys, listItems, pluckLink, recordExtractionFailure, resetExtraction, setBlobKeys,
} from "./index.ts";
import { items } from "./collections.ts";
import { twoUsers } from "./testing.ts";

const page = { status: "inbox" as const, sort: "newest" as const, limit: 50 };
const extraction = {
  kind: "link" as const, title: "Extracted title", siteName: "Example", author: null, excerpt: "An excerpt",
  canonicalUrl: null, lang: "en", wordCount: 120, markdown: "Body text", extractor: "defuddle",
};

describe("two-user scoping", () => {
  test("B never sees, reads, changes or lists A's item", async () => {
    const { a, b } = await twoUsers();
    const { item } = await pluckLink(a, { url: "https://example.com/a", source: "web" });
    await applyExtraction(a, item.id, extraction);
    await setBlobKeys(a, item.id, { coverKey: "k" });

    expect(await getItem(b, item.id)).toBeNull();
    expect(await getContent(b, item.id)).toBeNull();
    expect(await getItemBlobKeys(b, item.id)).toBeNull();
    expect((await listItems(b, page)).items).toHaveLength(0);
    expect(await applyExtraction(b, item.id, { ...extraction, title: "hijack" })).toBeNull();
    expect(await recordExtractionFailure(b, item.id, "x", true)).toBeNull();
    expect(await resetExtraction(b, item.id)).toBeNull();
    await setBlobKeys(b, item.id, { coverKey: "hijack" });

    const mine = await getItem(a, item.id);
    expect(mine?.title).toBe("Extracted title");
    expect(mine?.extraction.state).toBe("done");
    expect((await getItemBlobKeys(a, item.id))?.coverKey).toBe("k");
    expect((await getContent(a, item.id))?.textMarkdown).toBe("Body text");
  });

  test("the same URL plucked by two users makes two items", async () => {
    const { a, b } = await twoUsers();
    const ra = await pluckLink(a, { url: "https://example.com/shared", source: "web" });
    const rb = await pluckLink(b, { url: "https://example.com/shared", source: "web" });
    expect(ra.created && rb.created).toBe(true);
    expect(ra.item.id).not.toBe(rb.item.id);
  });
});

describe("re-pluck", () => {
  test("brings an archived item back to the Inbox without a second item, and keeps notes", async () => {
    const { a } = await twoUsers();
    const first = await pluckLink(a, { url: "https://example.com/r", source: "web", note: "first" });
    await (await items()).updateMany({ url: "https://example.com/r" }, { $set: { status: "archived", archivedReason: "user", deletedAt: new Date() } });
    const again = await pluckLink(a, { url: "https://example.com/r", source: "extension", note: "second" });
    expect(again.created).toBe(false);
    expect(again.item.id).toBe(first.item.id);
    expect(again.item.status).toBe("inbox");
    expect(again.item.archivedReason).toBeNull();
    expect(again.item.note).toBe("first\n\nsecond");
    expect(await getItem(a, first.item.id)).not.toBeNull(); // out of the bin
    expect((await listItems(a, page)).items).toHaveLength(1);
  });

  test("a failed item is re-extracted on re-pluck; a done one is not", async () => {
    const { a } = await twoUsers();
    const { item } = await pluckLink(a, { url: "https://example.com/f", source: "web" });
    await recordExtractionFailure(a, item.id, "HTTP 500", true);
    expect((await pluckLink(a, { url: "https://example.com/f", source: "web" })).needsExtraction).toBe(true);
    await applyExtraction(a, item.id, extraction);
    expect((await pluckLink(a, { url: "https://example.com/f", source: "web" })).needsExtraction).toBe(false);
  });

  test("concurrent plucks of one URL make one item", async () => {
    const { a } = await twoUsers();
    const results = await Promise.all(Array.from({ length: 5 }, () => pluckLink(a, { url: "https://example.com/race", source: "web" })));
    expect(new Set(results.map((r) => r.item.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });
});

test("a title the user typed survives extraction", async () => {
  const { a } = await twoUsers();
  const { item } = await pluckLink(a, { url: "https://example.com/t", source: "web" });
  await (await items()).updateOne({ url: "https://example.com/t" }, { $set: { title: "Mine", titleIsDerived: false } });
  expect((await applyExtraction(a, item.id, extraction))?.title).toBe("Mine");
});

test("listItems pages newest first with opaque cursors", async () => {
  const { a } = await twoUsers();
  for (let i = 0; i < 7; i++) await pluckLink(a, { url: `https://example.com/p${i}`, source: "web" });
  const first = await listItems(a, { ...page, limit: 3 });
  const second = await listItems(a, { ...page, limit: 3, cursor: first.nextCursor! });
  const third = await listItems(a, { ...page, limit: 3, cursor: second.nextCursor! });
  const urls = [...first.items, ...second.items, ...third.items].map((i) => i.url);
  expect(urls).toEqual([6, 5, 4, 3, 2, 1, 0].map((i) => `https://example.com/p${i}`));
  expect(third.nextCursor).toBeNull();
  expect((await listItems(a, { ...page, sort: "untouched", limit: 1 })).items[0]?.url).toBe("https://example.com/p0");
});

test("a malformed id finds nothing", async () => {
  const { a } = await twoUsers();
  expect(await getItem(a, "not-an-id")).toBeNull();
});
