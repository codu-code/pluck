import { describe, expect, test } from "vitest";
import { items } from "./collections.ts";
import {
  applyExtraction, batchUpdate, countItems, createHighlight, getContent, createTextItem, deleteHighlight, editItem, getItem, listHighlights, listItems, markOpened,
  createTag, listTags, moveToBin, pluckLink, purgeBin, restoreFromBin, setItemTags, updateHighlight,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const view = (status: "inbox" | "later" | "archive" | "bin", archive?: "all" | "you" | "expired" | "import") =>
  ({ status, archive, sort: "newest" as const, limit: 50 });

const selector = { textQuote: { exact: "scope", prefix: "the ", suffix: " is" }, textPosition: { start: 4, end: 9 } };

describe("status changes", () => {
  test("archive, later, done and back, with the reason and the time of the move", async () => {
    const { a } = await twoUsers();
    const link = (await pluckLink(a, { url: "https://example.com/s", source: "web" })).item;
    const { item: todo } = await createTextItem(a, { kind: "todo", text: "Book the room", source: "web" });

    const archived = await editItem(a, link.id, { status: "archived" });
    expect(archived).toMatchObject({ status: "archived", archivedReason: "user" });
    expect(new Date(archived!.statusChangedAt).getTime()).toBeGreaterThanOrEqual(new Date(link.statusChangedAt).getTime());
    expect((await editItem(a, link.id, { status: "inbox" }))?.archivedReason).toBeNull();
    await editItem(a, todo.id, { status: "done" });

    expect((await listItems(a, view("archive"))).items.map((i) => i.id)).toEqual([todo.id]);
    await editItem(a, link.id, { status: "archived" });
    expect((await listItems(a, view("archive", "you"))).items).toHaveLength(2);
    expect((await listItems(a, view("archive", "expired"))).items).toHaveLength(0);
    expect(await countItems(a, "inbox")).toBe(0);
  });

  test("the archive filters split by why an item moved", async () => {
    const { a } = await twoUsers();
    const ids = [];
    for (const reason of ["expired", "bulk", "import"] as const) {
      const it = (await pluckLink(a, { url: `https://example.com/${reason}`, source: "web" })).item;
      await (await items()).updateOne({ url: it.url }, { $set: { status: "archived", archivedReason: reason } });
      ids.push(it.id);
    }
    expect((await listItems(a, view("archive", "expired"))).items).toHaveLength(2);
    expect((await listItems(a, view("archive", "import"))).items).toHaveLength(1);
  });
});

describe("batch", () => {
  test("applies one change to many, skipping what does not fit, never touching B's items", async () => {
    const { a, b } = await twoUsers();
    const l1 = (await pluckLink(a, { url: "https://example.com/b1", source: "web" })).item;
    const l2 = (await pluckLink(a, { url: "https://example.com/b2", source: "web" })).item;
    const { item: todo } = await createTextItem(a, { kind: "todo", text: "t", source: "web" });
    const theirs = (await pluckLink(b, { url: "https://example.com/b3", source: "web" })).item;

    expect(await batchUpdate(a, [l1.id, l2.id, theirs.id], { status: "later" })).toEqual({ matched: 2, updated: 2 });
    expect((await getItem(b, theirs.id))?.status).toBe("inbox");

    // Done only fits the todo.
    expect((await batchUpdate(a, [l1.id, todo.id], { status: "done" })).updated).toBe(1);
    expect((await getItem(a, l1.id))?.status).toBe("later");
    // A link kind only fits links; a text kind only fits items with no URL.
    expect((await batchUpdate(a, [l1.id, todo.id], { kind: "video" })).updated).toBe(1);
    expect((await getItem(a, todo.id))?.kind).toBe("todo");
    expect((await batchUpdate(a, [l1.id, todo.id], { kind: "thing" })).updated).toBe(1);
    expect((await getItem(a, l1.id))?.kind).toBe("video");
  });
});

describe("bin", () => {
  test("delete hides an item, restore brings it back, purge removes it after 30 days", async () => {
    const { a, b } = await twoUsers();
    const it = (await pluckLink(a, { url: "https://example.com/bin", source: "web" })).item;
    expect(await moveToBin(b, it.id)).toBe(false);
    expect(await moveToBin(a, it.id)).toBe(true);
    expect(await getItem(a, it.id)).toBeNull();
    expect((await listItems(a, view("inbox"))).items).toHaveLength(0);
    expect((await listItems(a, view("bin"))).items.map((i) => i.id)).toEqual([it.id]);
    expect(await restoreFromBin(b, it.id)).toBeNull();
    expect((await restoreFromBin(a, it.id))?.id).toBe(it.id);

    await applyExtraction(a, it.id, { kind: "link", title: "t", siteName: null, author: null, excerpt: null, canonicalUrl: null, lang: null, wordCount: 1, markdown: "kept", extractor: "defuddle", preview: "reader", facts: {} });
    await moveToBin(a, it.id);
    expect((await purgeBin()).purged).toBe(0);
    const later = new Date(Date.now() + 31 * 86_400_000);
    const res = await purgeBin(later);
    expect(res.purged).toBe(1);
    expect(res.blobPrefixes).toEqual([`u/${a}/items/${it.id}/`]);
    expect(await getContent(a, it.id)).toBeNull();
    expect(await restoreFromBin(a, it.id)).toBeNull();
  });

  test("the purge removes files before rows: if the files fail, the rows stay for the next run", async () => {
    const { a } = await twoUsers();
    const it = (await pluckLink(a, { url: "https://example.com/purge-fail", source: "web" })).item;
    await moveToBin(a, it.id);
    const later = new Date(Date.now() + 31 * 86_400_000);
    await expect(purgeBin(later, async () => { throw new Error("S3 down"); })).rejects.toThrow("S3 down");
    expect((await listItems(a, view("bin"))).items.map((i) => i.id)).toContain(it.id);
  });

  test("a tag's count leaves out the bin, and comes back on restore and on re-pluck", async () => {
    const { a } = await twoUsers();
    const it = (await pluckLink(a, { url: "https://example.com/counted", source: "web" })).item;
    const tag = (await createTag(a, "counted", "user"))!.tag;
    await setItemTags(a, it.id, [tag.id], "user");
    const count = async () => (await listTags(a)).find((t) => t.id === tag.id)?.count;
    expect(await count()).toBe(1);
    await moveToBin(a, it.id);
    expect(await count()).toBe(0);
    await restoreFromBin(a, it.id);
    expect(await count()).toBe(1);
    await moveToBin(a, it.id);
    await pluckLink(a, { url: "https://example.com/counted", source: "web" });
    expect(await count()).toBe(1);
  });
});

describe("highlights", () => {
  test("only on the owner's links, listed in order, noted, removed", async () => {
    const { a, b } = await twoUsers();
    const link = (await pluckLink(a, { url: "https://example.com/h", source: "web" })).item;
    const { item: note } = await createTextItem(a, { kind: "note", text: "n", source: "web" });
    expect(await createHighlight(a, { itemId: note.id, quote: "n", selector })).toBeNull();
    expect(await createHighlight(b, { itemId: link.id, quote: "scope", selector })).toBeNull();

    const h = await createHighlight(a, { itemId: link.id, quote: "scope", selector });
    expect(h).toMatchObject({ quote: "scope", note: null, selector });
    expect(await listHighlights(b, link.id)).toEqual([]);
    expect(await updateHighlight(b, h!.id, "hijack")).toBeNull();
    expect((await updateHighlight(a, h!.id, "for the talk"))?.note).toBe("for the talk");
    expect(await deleteHighlight(b, h!.id)).toBe(false);
    expect(await deleteHighlight(a, h!.id)).toBe(true);
    expect(await listHighlights(a, link.id)).toEqual([]);
  });
});

test("opening touches; reading progress alone does not", async () => {
  const { a } = await twoUsers();
  const it = (await pluckLink(a, { url: "https://example.com/o", source: "web" })).item;
  await (await items()).updateOne({ url: it.url }, { $set: { lastTouchedAt: new Date(0) } });
  // The shape updateItem sends: every field key present, only readingProgress set.
  await editItem(a, it.id, { readingProgress: 0.4, dueAt: undefined, title: undefined });
  expect((await getItem(a, it.id))?.lastTouchedAt).toBe(new Date(0).toISOString());
  expect((await getItem(a, it.id))?.readingProgress).toBe(0.4);
  await markOpened(a, it.id);
  expect(new Date((await getItem(a, it.id))!.lastTouchedAt).getTime()).toBeGreaterThan(0);
});
