import { ObjectId } from "mongodb";
import { expect, test } from "vitest";
import { highlights, items } from "./collections.ts";
import {
  applyExtraction, createHighlight, deleteHighlight, findHighlights, foldAllHighlights, moveToBin, pluckLink, searchItems, updateHighlight,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const selector = { textQuote: { exact: "", prefix: "", suffix: "" }, textPosition: { start: 0, end: 0 } };
const link = async (userId: string, slug: string) => (await pluckLink(userId, { url: `https://example.com/${slug}`, source: "web" })).item;
const found = async (userId: string, word: string) => (await searchItems(userId, { q: word, limit: 25 })).results.map((r) => r.item.id);
const extracted = (excerpt: string) => ({
  kind: "link" as const, title: "A page", siteName: "Example", author: "Ada Writer", excerpt, canonicalUrl: null, lang: "en",
  wordCount: 10, markdown: "The body says little.", extractor: "defuddle", preview: "reader" as const, facts: {},
});

test("a word only in a highlight or its note finds the Item, until the highlight goes; another person is untouched", async () => {
  const { a, b } = await twoUsers();
  const item = await link(a, "one");
  const theirs = await link(b, "one");
  const h = (await createHighlight(a, { itemId: item.id, quote: "the zeitgeber resets the clock", selector }))!;
  expect(await found(a, "zeitgeber")).toEqual([item.id]);
  expect(await found(b, "zeitgeber")).toEqual([]);

  await updateHighlight(a, h.id, "ask Marguerite about this");
  expect(await found(a, "marguerite")).toEqual([item.id]);
  await updateHighlight(a, h.id, null);
  expect(await found(a, "marguerite")).toEqual([]);

  // B cannot remove or edit A's highlight, and B's own Item never carries A's words.
  expect(await deleteHighlight(b, h.id)).toBe(false);
  expect(await updateHighlight(b, h.id, "mine now")).toBeNull();
  expect(await found(a, "zeitgeber")).toEqual([item.id]);
  expect((await (await items()).findOne({ _id: new ObjectId(theirs.id) }))!.searchText).not.toContain("zeitgeber");

  expect(await deleteHighlight(a, h.id)).toBe(true);
  expect(await found(a, "zeitgeber")).toEqual([]);
});

test("highlights sit after the excerpt, site and author, are capped, and stay when the page is read again", async () => {
  const { a } = await twoUsers();
  const item = await link(a, "two");
  await applyExtraction(a, item.id, extracted("An excerpt about marmalade."));
  await createHighlight(a, { itemId: item.id, quote: `${"filler ".repeat(2000)} unreachable`, note: "noteword comes first", selector });
  const text = (await (await items()).findOne({ _id: new ObjectId(item.id) }))!.searchText!;
  expect(text.startsWith("An excerpt about marmalade. · Example · example.com · Ada Writer")).toBe(true);
  expect(text.length).toBeLessThan(8_200);
  expect(await found(a, "noteword")).toEqual([item.id]);
  expect(await found(a, "unreachable")).toEqual([]); // past the cap

  await applyExtraction(a, item.id, extracted("A new excerpt about quince."));
  expect(await found(a, "noteword")).toEqual([item.id]);
  expect(await found(a, "quince")).toEqual([item.id]);
  expect(await found(a, "marmalade")).toEqual([]);
});

test("the one-off pass makes highlights from before findable, each under its own person", async () => {
  const { a, b } = await twoUsers();
  const mine = await link(a, "three");
  const theirs = await link(b, "three");
  // As they were written before highlights were searched: the row alone.
  const old = (userId: string, itemId: string, quote: string) => ({ _id: new ObjectId(), userId: new ObjectId(userId), itemId: new ObjectId(itemId), quote, note: null, selector, createdAt: new Date() });
  await (await highlights()).insertMany([old(a, mine.id, "an okapi in the reeds"), old(b, theirs.id, "a tapir in the reeds")]);
  expect(await found(a, "okapi")).toEqual([]);
  const folded = await foldAllHighlights(); // every highlighted Item in the database, these two among them
  expect(folded).toBeGreaterThanOrEqual(2);
  expect(await found(a, "okapi")).toEqual([mine.id]);
  expect(await found(a, "tapir")).toEqual([]);
  expect(await found(b, "tapir")).toEqual([theirs.id]);
  expect(await foldAllHighlights()).toBe(folded); // again changes nothing
  expect(await found(a, "okapi")).toEqual([mine.id]);
});

test("highlights across the library: newest first with their Item, by words, Item and date, paged, and never another person's or the bin's", async () => {
  const { a, b } = await twoUsers();
  const one = await link(a, "four");
  const two = await link(a, "five");
  const binned = await link(a, "six");
  const theirs = await link(b, "four");
  const made: string[] = [];
  for (const [itemId, quote, note] of [[one.id, "Small teams ship", null], [two.id, "a (very) short list", "TEAMS need this"], [one.id, "日本語の引用です", null], [binned.id, "gone with its item", null]] as const) {
    made.push((await createHighlight(a, { itemId, quote, note, selector }))!.id);
    await new Promise((r) => setTimeout(r, 5)); // each a little later than the last
  }
  await createHighlight(b, { itemId: theirs.id, quote: "small teams, but theirs", selector });
  await moveToBin(a, binned.id);
  const q = (extra = {}) => findHighlights(a, { limit: 25, offset: 0, ...extra });

  const all = await q();
  expect(all.highlights.map((h) => h.id)).toEqual([made[2], made[1], made[0]]);
  expect(all.more).toBe(false);
  expect(all.highlights[1]).toEqual({ id: made[1], quote: "a (very) short list", note: "TEAMS need this", createdAt: expect.any(String), item: { id: two.id, title: two.title, url: two.url, siteName: "example.com" } });

  expect((await q({ query: "teams" })).highlights.map((h) => h.id)).toEqual([made[1], made[0]]); // the quote or the note, any case
  expect((await q({ query: "teams list" })).highlights.map((h) => h.id)).toEqual([made[1]]); // every word
  expect((await q({ query: "(very)" })).highlights.map((h) => h.id)).toEqual([made[1]]); // not read as a pattern
  expect((await q({ query: ".*" })).highlights).toEqual([]);
  expect((await q({ query: "引用" })).highlights.map((h) => h.id)).toEqual([made[2]]);
  expect((await q({ itemId: one.id })).highlights.map((h) => h.id)).toEqual([made[2], made[0]]);
  expect((await q({ itemId: theirs.id })).highlights).toEqual([]);
  expect((await q({ since: all.highlights[1]!.createdAt })).highlights.map((h) => h.id)).toEqual([made[2], made[1]]);

  const first = await q({ limit: 2 });
  expect(first.highlights.map((h) => h.id)).toEqual([made[2], made[1]]);
  expect(first.more).toBe(true);
  const second = await q({ limit: 2, offset: 2 });
  expect(second.highlights.map((h) => h.id)).toEqual([made[0]]);
  expect(second.more).toBe(false);
});
