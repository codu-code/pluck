import { describe, expect, test } from "vitest";
import {
  applyExtraction, createTextItem, editItem, findByUrl, getContent, getItem, getItemBlobKeys, listItems, moveToBin, pluckLink, purgeFromBin, recordExtractionFailure, restoreFromBin, resetExtraction, setBlobKeys,
} from "./index.ts";
import { items, oid } from "./collections.ts";
import { twoUsers } from "./testing.ts";

const page = { status: "inbox" as const, sort: "newest" as const, limit: 50 };
const extraction = {
  kind: "link" as const, title: "Extracted title", siteName: "Example", author: null, excerpt: "An excerpt",
  canonicalUrl: null, lang: "en", wordCount: 120, markdown: "Body text", extractor: "defuddle", preview: "reader" as const, facts: {},
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
    const again = await pluckLink(a, { url: "https://example.com/f", source: "web" });
    expect(again.needsExtraction).toBe(true);
    expect(again.item.extraction).toEqual({ state: "pending", attempts: 0, lastError: null }); // the job reads it, not skips it
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

test("a title the user typed survives extraction, and only its owner's extraction names it", async () => {
  const { a, b } = await twoUsers();
  const { item } = await pluckLink(a, { url: "https://example.com/t", source: "web" });
  expect(await applyExtraction(b, item.id, { ...extraction, title: "Not yours" })).toBeNull();
  expect((await applyExtraction(a, item.id, { ...extraction, title: "Read" }))?.title).toBe("Read");
  await (await items()).updateOne({ _id: oid(item.id) }, { $set: { title: "Mine", titleIsDerived: false } });
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

describe("notes, todos and things", () => {
  test("a note takes its title from the first line until a title is typed, and back again when cleared", async () => {
    const { a, b } = await twoUsers();
    const { item: note } = await createTextItem(a, { kind: "note", text: "Kitchen plan\nHob under the window.", source: "web" });
    expect(note).toMatchObject({ kind: "note", url: null, title: "Kitchen plan", titleIsDerived: true, excerpt: "Hob under the window." });
    expect(note.extraction.state).toBe("none");
    expect((await getContent(a, note.id))?.textMarkdown).toBe("Kitchen plan\nHob under the window.");

    expect((await editItem(a, note.id, { text: "Kitchen plan v2\nHob on the island." }))?.title).toBe("Kitchen plan v2");
    const typed = await editItem(a, note.id, { title: "Reno" });
    expect(typed).toMatchObject({ title: "Reno", titleIsDerived: false, excerpt: "Kitchen plan v2 Hob on the island." });
    expect((await editItem(a, note.id, { text: "Third draft\nbody" }))?.title).toBe("Reno");
    expect((await editItem(a, note.id, { title: "" }))?.title).toBe("Third draft");

    // B can neither edit nor read it.
    expect(await editItem(b, note.id, { text: "hijack" })).toBeNull();
    expect((await getContent(a, note.id))?.textMarkdown).toBe("Third draft\nbody");
  });

  test("kind and due date change, and notes have no URL hash so many can exist", async () => {
    const { a } = await twoUsers();
    const { item: one } = await createTextItem(a, { kind: "note", text: "same", source: "web" });
    const { item: two } = await createTextItem(a, { kind: "note", text: "same", source: "web" });
    expect(one.id).not.toBe(two.id);
    const due = new Date("2026-11-03T09:00:00.000Z");
    const todo = await editItem(a, one.id, { kind: "todo", dueAt: due });
    expect(todo).toMatchObject({ kind: "todo", dueAt: due.toISOString() });
    expect((await editItem(a, one.id, { dueAt: null }))?.dueAt).toBeNull();
  });

  test("a resent note with the same key is made once, even sent twice at once; another person's key is theirs", async () => {
    const { a, b } = await twoUsers();
    const send = (u: string) => createTextItem(u, { kind: "note", text: "Offline", source: "web", clientKey: "k-1" });
    const [first, again] = await Promise.all([send(a), send(a)]);
    expect([first.created, again.created].sort()).toEqual([false, true]);
    expect(again.item.id).toBe(first.item.id);
    expect((await send(a)).created).toBe(false);
    const theirs = await send(b);
    expect(theirs.created).toBe(true);
    expect(theirs.item.id).not.toBe(first.item.id);
  });
});

test("findByUrl finds only the person's own live item", async () => {
  const { a, b } = await twoUsers();
  const { item } = await pluckLink(a, { url: "https://example.test/find-me", source: "web" });
  expect((await findByUrl(a, "https://example.test/find-me"))?.id).toBe(item.id);
  expect(await findByUrl(b, "https://example.test/find-me")).toBeNull();
  await moveToBin(a, item.id);
  expect(await findByUrl(a, "https://example.test/find-me")).toBeNull();
});

test("Delete forever takes only the person's own Item, only from the bin, files first", async () => {
  const { a, b } = await twoUsers();
  const { item } = await pluckLink(a, { url: "https://example.test/gone-for-good", source: "web" });
  const removed: string[][] = [];
  const files = async (p: string[]) => void removed.push(p);
  expect(await purgeFromBin(a, item.id, files)).toBe(false); // still in the Inbox: delete it first
  await moveToBin(a, item.id);
  expect(await purgeFromBin(b, item.id, files)).toBe(false); // not theirs
  expect(await (await items()).countDocuments({ _id: oid(item.id) })).toBe(1);
  expect(await purgeFromBin(a, item.id, files)).toBe(true);
  expect(removed).toEqual([[`u/${a}/items/${item.id}/`]]);
  expect(await (await items()).countDocuments({ _id: oid(item.id) })).toBe(0);
  expect(await restoreFromBin(a, item.id)).toBeNull(); // nothing left to put back
});

test("a purge claims its Items first: a Restore or re-pluck while it runs never revives one whose text is going", async () => {
  const { a, b } = await twoUsers();
  const url = "https://example.test/mid-purge";
  const { item } = await pluckLink(a, { url, source: "web" });
  await applyExtraction(a, item.id, extraction);
  const theirs = (await pluckLink(b, { url, source: "web" })).item;
  await applyExtraction(b, theirs.id, extraction);
  await moveToBin(a, item.id);
  await moveToBin(b, theirs.id);
  let fresh: Awaited<ReturnType<typeof pluckLink>> | undefined;
  // Restore and re-pluck land while the files are being removed, after the claim.
  expect(await purgeFromBin(a, item.id, async () => {
    expect(await restoreFromBin(a, item.id)).toBeNull();
    fresh = await pluckLink(a, { url, source: "web" });
  })).toBe(true);
  expect(fresh?.created).toBe(true);
  expect(fresh?.item.id).not.toBe(item.id);
  await applyExtraction(a, fresh!.item.id, extraction);
  expect(await getContent(a, fresh!.item.id)).not.toBeNull();
  expect(await (await items()).countDocuments({ _id: oid(item.id) })).toBe(0);
  expect((await findByUrl(a, url))?.id).toBe(fresh!.item.id);
  // B's Item at the same address is B's alone: still in their bin with its text, and theirs to restore.
  expect((await restoreFromBin(b, theirs.id))?.id).toBe(theirs.id);
  expect(await getContent(b, theirs.id)).not.toBeNull();
});

test("a purge whose files fail keeps its claim: the Item cannot be restored, and the next try finishes it", async () => {
  const { a } = await twoUsers();
  const { item } = await pluckLink(a, { url: "https://example.test/purge-retry", source: "web" });
  await moveToBin(a, item.id);
  await expect(purgeFromBin(a, item.id, async () => { throw new Error("S3 down"); })).rejects.toThrow("S3 down");
  expect(await restoreFromBin(a, item.id)).toBeNull();
  expect(await purgeFromBin(a, item.id)).toBe(true);
  expect(await (await items()).countDocuments({ _id: oid(item.id) })).toBe(0);
});
