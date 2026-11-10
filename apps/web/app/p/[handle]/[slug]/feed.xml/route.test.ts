import { createTextItem, pluckLink } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { closeAccountPages, newList, publicPage, readList, setListVisibility, takeDownList, updateMe } from "@/lib/library";
import { listAddress } from "../address";
import { GET } from "./route";

const feed = (handle: string, slug: string) => GET(new Request("http://x/feed.xml"), { params: Promise.resolve({ handle, slug }) });

// A public List of two links and a Note, with every character XML minds in its words.
async function publicListOf(owner: string, name: string) {
  const handle = `feed-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  await updateMe(owner, { handle });
  const { item: fish } = await pluckLink(owner, { url: "https://example.com/fish?a=1&b=2", title: `Fish & chips <b>"best"</b> 'ever'`, source: "web" });
  const { item: tokyo } = await pluckLink(owner, { url: "https://example.com/tokyo", title: "東京の喫茶店 \u0007ガイド", source: "web" });
  const { item: note } = await createTextItem(owner, { kind: "note", text: "Book the ferry", source: "web" });
  const list = await newList(owner, {
    name, purpose: `For Tom & Ann, <soon>`,
    items: [{ itemId: fish.id, note: `Why: 5 < 6 & "so on"` }, { itemId: tokyo.id, note: null }, { itemId: note.id, note: null }],
  });
  return { handle, list: await setListVisibility(owner, list.id, "public") };
}

// A small XML reader for what the feed is made of. It stops at the first thing that is not XML (a bare & or <, an
// unquoted attribute), and every tag must close in order: what a feed reader's parser would refuse fails here.
function read(xml: string): { text: Record<string, string[]>; href: Record<string, string[]> } {
  const plain = (s: string) => s.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
  const text: Record<string, string[]> = {}, href: Record<string, string[]> = {};
  const open: string[] = [];
  const token = /<\?xml version="1\.0" encoding="utf-8"\?>|<(\/)?([a-z]+)((?: [a-z]+="(?:[^"<&]|&#\d+;)*")*)(\/)?>|((?:[^<&]|&#\d+;)+)/y;
  let at = 0;
  for (let m = token.exec(xml); m; m = token.exec(xml)) {
    at = token.lastIndex;
    const [, closes, tag, attrs, empty, words] = m;
    const path = [...open, tag].filter(Boolean).join("/");
    if (tag && closes) expect(open.pop()).toBe(tag);
    else if (tag && empty) (href[path] ??= []).push(plain(/ href="([^"]*)"/.exec(attrs ?? "")?.[1] ?? ""));
    else if (tag) open.push(tag);
    else if (words?.trim()) (text[path] ??= []).push(plain(words));
  }
  expect([at, open]).toEqual([xml.length, []]);
  return { text, href };
}

test("a public List's feed is the page in Atom: its name, purpose and each Item the page shows, in order, escaped", async () => {
  const { a } = await twoUsers();
  const { handle, list } = await publicListOf(a, `Café 東京 & "reads" <2026>`);
  const page = (await publicPage(handle, list.slug, { count: false }))!;
  const res = await feed(handle, encodeURIComponent(list.slug)); // as the /@handle/slug rewrite hands it on
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/atom+xml; charset=utf-8");
  expect(res.headers.get("cache-control")).toBe("private, no-cache, no-store, max-age=0, must-revalidate");
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow"); // a new List, as on the page
  const xml = await res.text();
  expect(xml).toContain("<title>Fish &#38; chips &#60;b&#62;&#34;best&#34;&#60;/b&#62; &#39;ever&#39;</title>");
  expect(xml).toContain("<title>東京の喫茶店 ガイド</title>"); // as written, less the control character XML cannot carry

  const at = listAddress(handle, list.slug);
  const { text, href } = read(xml);
  expect(text).toEqual({
    "feed/id": [`urn:pluck:list:${list.id}`],
    "feed/title": [`Café 東京 & "reads" <2026>`],
    "feed/subtitle": ["For Tom & Ann, <soon>"],
    "feed/updated": [page.list.updatedAt],
    "feed/author/name": [`@${handle}`],
    "feed/entry/id": page.entries.map((e) => `urn:pluck:list:${list.id}:${e.id}`),
    "feed/entry/title": [`Fish & chips <b>"best"</b> 'ever'`, "東京の喫茶店 ガイド", "Book the ferry"],
    "feed/entry/updated": page.entries.map(() => page.list.updatedAt),
    "feed/entry/summary": [`Why: 5 < 6 & "so on"`], // the List's note, where the page shows one
  });
  expect(page.entries.map((e) => e.title.replace("\u0007", ""))).toEqual(text["feed/entry/title"]); // the page's Items, in the page's order
  expect(href).toEqual({
    "feed/link": [`${at}/feed.xml`, at],
    "feed/entry/link": ["https://example.com/fish?a=1&b=2", "https://example.com/tokyo", at], // a Note has no link of its own
  });
  expect(at).toContain(`/@${handle}/caf%C3%A9-`);
  for (const secret of ["tags", "status", "ticked", "marked", "content"]) expect(xml).not.toContain(secret);

  expect(await (await feed(handle, list.slug)).text()).toBe(xml); // the same ids and times on every fetch
  expect((await readList(a, list.id)).list.views).toBe(0); // reading the feed is not a view
});

test("a List that is Private, taken down, or whose owner's public pages are closed has no feed: a 404, as its page is", async () => {
  const { a, b } = await twoUsers();
  const mine = await publicListOf(a, "Short lived");
  const gone = async (handle: string, slug: string) => {
    const res = await feed(handle, slug);
    expect([res.status, await res.text(), res.headers.get("content-type")]).toEqual([404, "", null]);
    expect(await publicPage(handle, slug, { count: false })).toBeNull(); // the page's own answer
  };
  expect((await feed(mine.handle, mine.list.slug)).status).toBe(200);
  await gone(mine.handle, "no-such-list");
  await setListVisibility(a, mine.list.id, "private");
  await gone(mine.handle, mine.list.slug);
  await setListVisibility(a, mine.list.id, "public");
  expect((await feed(mine.handle, mine.list.slug)).status).toBe(200);
  await takeDownList(mine.list.id);
  await gone(mine.handle, mine.list.slug);

  const theirs = await publicListOf(b, "Closed account");
  expect((await feed(theirs.handle, theirs.list.slug)).status).toBe(200);
  await closeAccountPages(b);
  await gone(theirs.handle, theirs.list.slug);
});
