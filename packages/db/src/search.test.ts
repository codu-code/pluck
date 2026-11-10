import { ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { items } from "./collections.ts";
import {
  applyExtraction, createTag, createTextItem, deleteTag, editItem, pluckLink, renameTag, searchItems, setItemTags, snippetFor,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const q = (text: string, extra = {}) => ({ q: text, limit: 25, ...extra });
const extracted = (markdown: string, title = "A page") => ({
  kind: "link" as const, title, siteName: "Example", author: null, excerpt: markdown.slice(0, 80), canonicalUrl: null, lang: "en",
  wordCount: 10, markdown, extractor: "defuddle", preview: "reader" as const, facts: {},
});

describe("search", () => {
  test("snippets show the words, not the markdown around them", () => {
    const searchBody = "![](https://x.test/cover.png)\n\nPhotograph: **Example** Media. Most [teams](https://x.test) do not have a tooling problem.";
    expect(snippetFor({ note: null, excerpt: null, searchBody }, "teams")).toEqual({ source: "body", pre: "Photograph: Example Media. Most ", hit: "teams", post: " do not have a tooling problem." });
  });

  test("finds body, note and tag text, ranks titles first, and never crosses users", async () => {
    const { a, b } = await twoUsers();
    const inBody = (await pluckLink(a, { url: "https://example.com/body", source: "web" })).item;
    await applyExtraction(a, inBody.id, extracted("Long text where window functions appear deep inside the article body."));
    const inTitle = (await pluckLink(a, { url: "https://example.com/title", source: "web" })).item;
    await applyExtraction(a, inTitle.id, extracted("Nothing relevant here.", "Window functions, finally"));
    const { item: note } = await createTextItem(a, { kind: "note", text: "Kitchen\nmeasure the worktop", source: "web" });
    await editItem(a, note.id, { note: null });
    const tag = (await createTag(a, "postgres", "user"))!.tag;
    await setItemTags(a, note.id, [tag.id], "user");
    await pluckLink(b, { url: "https://example.com/theirs", source: "web" });

    const res = await searchItems(a, q("window functions"));
    expect(res.results.map((r) => r.item.id)).toEqual([inTitle.id, inBody.id]);
    expect(res.total).toBe(2);
    expect(res.results[1]!.snippet).toMatchObject({ source: "body", hit: "window functions" });
    expect((await searchItems(a, q("worktop"))).results[0]!.item.id).toBe(note.id);
    expect((await searchItems(a, q("postgres"))).results[0]!.item.id).toBe(note.id);
    expect((await searchItems(b, q("window functions"))).results).toHaveLength(0);
  });

  test("tag renames and deletes reach search", async () => {
    const { a } = await twoUsers();
    const { item: note } = await createTextItem(a, { kind: "note", text: "Plain", source: "web" });
    const t = (await createTag(a, "pg", "user"))!.tag;
    await setItemTags(a, note.id, [t.id], "user");
    await renameTag(a, t.id, "databases");
    expect((await searchItems(a, q("databases"))).total).toBe(1);
    expect((await searchItems(a, q("pg"))).total).toBe(0);
    await deleteTag(a, t.id, { removeFromItems: true });
    expect((await searchItems(a, q("databases"))).total).toBe(0);
  });

  test("filters, archive included, bin excluded, and a pasted URL pins its item", async () => {
    const { a } = await twoUsers();
    const link = (await pluckLink(a, { url: "https://example.com/pinned?id=1", source: "web" })).item;
    await applyExtraction(a, link.id, extracted("sourdough starter notes"));
    const { item: archived } = await createTextItem(a, { kind: "todo", text: "Feed the sourdough", source: "web" });
    await editItem(a, archived.id, { status: "archived" });
    const { item: binned } = await createTextItem(a, { kind: "note", text: "sourdough in the bin", source: "web" });
    await (await items()).updateOne({ _id: new ObjectId(binned.id) }, { $set: { deletedAt: new Date() } });

    expect((await searchItems(a, q("sourdough"))).total).toBe(2);
    expect((await searchItems(a, q("sourdough", { status: "archived" }))).results.map((r) => r.item.id)).toEqual([archived.id]);
    expect((await searchItems(a, q("sourdough", { kinds: ["link"] }))).results.map((r) => r.item.id)).toEqual([link.id]);
    const pinned = await searchItems(a, q("https://Example.com/pinned?id=1&utm_source=x"));
    expect(pinned.results[0]!.item.id).toBe(link.id);
  });

  test("Japanese, Chinese and Korean are found inside a sentence, for their owner only", async () => {
    const { a, b } = await twoUsers();
    const note = async (who: string, text: string) => (await createTextItem(who, { kind: "note", text, source: "web" })).item.id;
    const tokyo = await note(a, "東京の天気は今日も晴れです");
    const beijing = await note(a, "北京的天气很好");
    const seoul = await note(a, "서울에서 맛있는 식당 찾기");
    const page = (await pluckLink(a, { url: "https://example.com/ja", source: "web" })).item;
    await applyExtraction(a, page.id, extracted(`${"前置きの文章が長く続きます。".repeat(30)}京都の紅葉は十一月が見頃です。${"あとがきも長く続きます。".repeat(30)}`, "Autumn"));
    await note(b, "東京の天気は今日も晴れです");

    const ids = async (who: string, text: string, extra = {}) => (await searchItems(who, q(text, extra))).results.map((r) => r.item.id);
    expect(await ids(a, "東京")).toEqual([tokyo]);
    expect(await ids(a, "天气")).toEqual([beijing]);
    expect(await ids(a, "서울")).toEqual([seoul]);
    expect(await ids(a, "天気 晴れ")).toEqual([tokyo]); // every term
    expect(await ids(a, "東京 天气")).toEqual([]);
    expect(await ids(a, "東京", { kinds: ["link"] })).toEqual([]);
    expect(await ids(b, "天气")).toEqual([]);
    expect((await searchItems(b, q("東京"))).total).toBe(1);

    const hit = (await searchItems(a, q("紅葉"))).results[0]!;
    expect(hit.item.id).toBe(page.id);
    expect(hit.snippet).toMatchObject({ source: "body", hit: "紅葉" });
    expect(hit.snippet!.pre.endsWith("京都の")).toBe(true);
    expect(hit.snippet!.pre.length + hit.snippet!.post.length).toBeLessThan(300); // a sentence with no spaces is still cut

    // Newest first, paged like any search.
    for (let i = 0; i < 3; i++) await note(a, `読書メモ ${i}`);
    const first = await searchItems(a, q("読書", { limit: 2 }));
    expect(first.total).toBe(3);
    expect(first.results.map((r) => r.item.title)).toEqual(["読書メモ 2", "読書メモ 1"]);
    expect((await searchItems(a, q("読書", { limit: 2, cursor: first.nextCursor! }))).results.map((r) => r.item.title)).toEqual(["読書メモ 0"]);
  });

  test("a pasted URL's item is first, and shown and counted once however far down its own hit is", async () => {
    const { a, b } = await twoUsers();
    // Six links whose titles are their URLs outrank the one with a typed title, so its own hit is on the last page.
    for (let i = 0; i < 6; i++) await pluckLink(a, { url: `https://example.com/paged/${i}`, source: "web" });
    const mine = (await pluckLink(a, { url: "https://example.com/paged/mine", title: "Kitchen", source: "web" })).item;
    await pluckLink(b, { url: "https://example.com/paged/mine", source: "web" });
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await searchItems(a, q("https://example.com/paged/mine", { limit: 3, cursor }));
      expect(res.total).toBe(7);
      seen.push(...res.results.map((r) => r.item.id));
      cursor = res.nextCursor ?? undefined;
    } while (cursor);
    expect(seen[0]).toBe(mine.id);
    expect(seen.filter((id) => id === mine.id)).toHaveLength(1);
    expect(new Set(seen).size).toBe(7);
  });

  test("pages with an opaque cursor", async () => {
    const { a } = await twoUsers();
    for (let i = 0; i < 5; i++) await createTextItem(a, { kind: "note", text: `ledger entry ${i}`, source: "web" });
    const first = await searchItems(a, q("ledger", { limit: 3 }));
    const second = await searchItems(a, q("ledger", { limit: 3, cursor: first.nextCursor! }));
    expect(new Set([...first.results, ...second.results].map((r) => r.item.id)).size).toBe(5);
    expect(second.nextCursor).toBeNull();
  });
});

const WORDS = "the a scope token server client index query row window function kitchen hob worktop sourdough starter guitar riff tempo estimate builder trench rate waste paragraph decision release review handoff".split(" ");

test("budget: 5,000 items, results in under 300 ms", async () => {
  const { a } = await twoUsers();
  const uid = new ObjectId(a);
  const now = Date.now();
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const sentence = (n: number) => Array.from({ length: n }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
  const docs = Array.from({ length: 5000 }, (_, i) => ({
    _id: new ObjectId(), userId: uid, kind: "link", url: `https://example.com/${i}`, canonicalUrl: null, title: sentence(8),
    titleIsDerived: true, siteName: "Example", author: null, excerpt: sentence(20), coverKey: null, htmlKey: null, status: "inbox",
    archivedReason: null, dueAt: null, tagIds: [], note: null, source: "import", readingProgress: 0, wordCount: 400, lang: "en",
    extraction: { state: "done", attempts: 1, lastError: null }, createdAt: new Date(now - i * 60_000), updatedAt: new Date(now),
    lastOpenedAt: null, lastTouchedAt: new Date(now), statusChangedAt: new Date(now), deletedAt: null,
    searchText: sentence(10), searchBody: sentence(400),
  }));
  // why: a raw seed is far faster than 5,000 plucks; the shape matches ItemDoc.
  await (await items()).insertMany(docs as never[]);

  const times: number[] = [];
  for (const term of ["window function", "sourdough starter", "kitchen hob worktop", "estimate"]) {
    const t0 = performance.now();
    const res = await searchItems(a, q(term));
    times.push(performance.now() - t0);
    expect(res.results.length).toBeGreaterThan(0);
  }
  times.sort((x, y) => x - y);
  expect(times[Math.floor(times.length / 2)]).toBeLessThan(300);
}, 60_000);
