import { countItems, digestFor, getMe, isEmptyDigest, listLists, updateSettings } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { expect, test, vi } from "vitest";
import { addItems, browse, giveStarters, listsOf, newList, pluckAny, readList, readText, removeList, startersBackfill } from "./index";

// The posts are Markdown the web app's bundler loads; here two short ones stand in.
vi.mock("../blog", () => ({
  findPost: async (locale: string, slug: string) => ({ slug, locale, title: `Post ${slug}`, description: "What it says.", body: "" }),
  postBody: () => ({ html: `<p>${"Nothing is ever thrown away here, and this sentence is long enough to be read as a page. ".repeat(12)}</p>` }),
}));

test("an account from before gets the two Lists once, in its language, and nothing in its library", async () => {
  const { a, b } = await twoUsers();
  await updateSettings(b, { locale: "fr" });
  expect((await listsOf(a)).map((l) => [l.name, l.visibility, l.itemCount])).toEqual([["Favourites", "private", 0], ["Ideas", "private", 0]]);
  expect((await listsOf(b)).map((l) => l.name)).toEqual(["Favoris", "Idées"]);
  expect((await browse(a, { status: "inbox", sort: "newest", limit: 50 })).items).toEqual([]);
  // Deleted Lists stay deleted, and asking again makes no more.
  for (const l of await listsOf(a)) await removeList(a, l.id);
  await giveStarters(a, { articles: true });
  expect(await listsOf(a)).toEqual([]);
  expect((await listsOf(b)).map((l) => l.name)).toEqual(["Favoris", "Idées"]);
});

test("a new account gets a post in the Inbox and one in Ideas, kept from our own words with nothing fetched", async () => {
  const { a, b } = await twoUsers();
  const fetched = vi.spyOn(globalThis, "fetch");
  await giveStarters(a, { articles: true, locale: "en", defer: () => {} }); // the pictures wait for after the response
  expect(fetched).not.toHaveBeenCalled();
  fetched.mockRestore();
  const inbox = (await browse(a, { status: "inbox", sort: "newest", limit: 50 })).items;
  expect(inbox.map((i) => [i.title, i.kind, i.extraction.state, i.inList])).toEqual([["Post nothing-is-deleted", "link", "done", false]]);
  expect(inbox[0]!.url).toMatch(/\/blog\/nothing-is-deleted$/);
  expect(await readText(a, inbox[0]!.id)).toContain("Nothing is ever thrown away here");
  const [ideas, favourites] = await listsOf(a);
  expect([ideas!.name, ideas!.itemCount, favourites!.name, favourites!.itemCount]).toEqual(["Ideas", 1, "Favourites", 0]);
  // In a List, so out of the Inbox and never expired.
  expect((await readList(a, ideas!.id)).entries.map((e) => [e.item.title, e.item.status, e.item.inList])).toEqual([["Post ask-your-ai-what-you-plucked", "archived", true]]);
  expect((await browse(b, { status: "inbox", sort: "newest", limit: 50 })).items).toEqual([]);
});

test("an account from before keeps its own Lists on top, and a List it already has by that name is not made twice", async () => {
  const { a } = await twoUsers();
  const mine = await newList(a, { name: "Trip to Kyoto" });
  const ideas = await newList(a, { name: "ideas" });
  expect((await listsOf(a)).map((l) => l.name)).toEqual(["ideas", "Trip to Kyoto", "Favourites"]); // theirs, as they were, then the one that was missing
  expect((await readList(a, ideas.id)).list.name).toBe("ideas");
  expect((await readList(a, mine.id)).entries).toEqual([]);
});

test("what an account starts with is never in the weekly email or counted as plucked, until a starter List is used", async () => {
  const { a } = await twoUsers();
  await giveStarters(a, { articles: true, locale: "en", defer: () => {} });
  const settings = (await getMe(a))!.settings;
  const later = (days: number) => new Date(Date.now() + days * 86_400_000);
  // Weeks on, with nothing of their own: no oldest-in-the-Inbox, nothing expiring, no quiet Lists, so no email.
  for (const days of [3, 25, 45]) expect(isEmptyDigest(await digestFor(a, settings, later(days)))).toBe(true);
  expect(await countItems(a)).toBe(2);
  expect(await countItems(a, undefined, { own: true })).toBe(0);

  // Their own pluck is in it, and a starter List they have put something in is a List like any other.
  const own = (await pluckAny(a, { text: "Mine", kind: "note" })).results[0]!.item;
  const favourites = (await listsOf(a)).find((l) => l.name === "Favourites")!;
  await addItems(a, favourites.id, [own.id]);
  const d = await digestFor(a, settings, later(45));
  expect(d.oldest.map((o) => o.title)).toEqual(["Mine"]);
  expect(d.quietLists.map((l) => l.name)).toEqual(["Favourites"]);
});

test("the worker gives accounts from before their Lists unasked, but leaves one still signing up to its sign-up", async () => {
  const { a, b } = await twoUsers();
  const mine = await newList(b, { name: "Ideas" }); // b made its own Ideas before
  // Made a moment ago: sign-up may still be at work, so the worker passes them by.
  expect(await startersBackfill()).toBe(0);
  expect(await listLists(a)).toEqual([]);
  const later = new Date(Date.now() + 3_600_000);
  while (await startersBackfill(later)) { /* every account, a few at a time, to the end */ }
  expect(await startersBackfill(later)).toBe(0); // given once: nothing left to ask about
  expect((await listLists(a)).map((l) => l.name).sort()).toEqual(["Favourites", "Ideas"]);
  expect((await listLists(b)).map((l) => [l.name, l.id === mine.id])).toEqual(expect.arrayContaining([["Ideas", true], ["Favourites", false]]));
  expect(await listLists(b)).toHaveLength(2); // no twin of the Ideas b already had
  expect((await browse(a, { status: "inbox", sort: "newest", limit: 50 })).items).toEqual([]); // Lists only, no posts
});
