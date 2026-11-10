import { getObject, listKeys } from "@pluck/blob";
import { createList, createTextItem, importLink, latestExport, pluckLink, startExport } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { parseImport } from "@pluck/extract";
import { strFromU8, unzipSync } from "fflate";
import { expect, test } from "vitest";
import { exportState, requestExport, runExport, sweepTransfersNow } from "./account";

test("lists whose names differ only in punctuation each get their own file in the export", async () => {
  const { a } = await twoUsers();
  await createList(a, { name: "Books", createdBy: "user", items: [] });
  await createList(a, { name: "books!", createdBy: "user", items: [] });
  await runExport(a, await startExport(a));
  const zip = unzipSync(new Uint8Array(await getObject((await latestExport(a))!.blobKey!)));
  expect(Object.keys(zip).filter((f) => f.startsWith("lists/"))).toHaveLength(2);
});

test("five exports a day each: the sixth is refused, and someone else is not held up", async () => {
  const { a, b } = await twoUsers();
  for (let i = 0; i < 5; i++) await requestExport(a);
  await expect(requestExport(a)).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  await expect(requestExport(b)).resolves.toHaveProperty("id");
});

test("the daily sweep removes an export's zip once its emailed link has run out, and no sooner", async () => {
  const { a } = await twoUsers();
  await runExport(a, await startExport(a));
  await sweepTransfersNow();
  expect(await listKeys(`u/${a}/exports/`)).toHaveLength(1);
  await sweepTransfersNow(new Date(Date.now() + 9 * 86_400_000));
  expect(await listKeys(`u/${a}/exports/`)).toEqual([]);
  expect(await exportState(a)).toBeNull();
});

test("a library bigger than one page of Items exports whole, and pluck.json reads as it always has", async () => {
  const { a } = await twoUsers();
  const texts = Array.from({ length: 510 }, (_, i) => `Note ${i}\nwith a second line`);
  for (let i = 0; i < texts.length; i += 30) await Promise.all(texts.slice(i, i + 30).map((text) => createTextItem(a, { kind: "note", text, source: "web" })));
  const one = (await createTextItem(a, { kind: "note", text: "In a list", source: "web" })).item;
  await createList(a, { name: "Kept", createdBy: "user", items: [{ itemId: one.id, note: "why" }] });
  await runExport(a, await startExport(a));
  const zip = unzipSync(new Uint8Array(await getObject((await latestExport(a))!.blobKey!)));
  const raw = strFromU8(zip["pluck.json"]!);
  const json = JSON.parse(raw) as { exportedAt: string; account: object; items: { id: string; text: string }[]; tags: unknown[]; lists: unknown[]; highlights: unknown[] };
  expect(raw).toBe(JSON.stringify(json, null, 2));
  expect(Object.keys(json)).toEqual(["exportedAt", "account", "items", "tags", "lists", "highlights"]);
  expect(json.items.map((i) => i.text).sort()).toEqual([...texts, "In a list"].sort());
  expect(Object.keys(zip).filter((f) => f.startsWith("items/")).sort()).toEqual(json.items.map((i) => `items/${i.id}.md`).sort());
  expect(strFromU8(zip["lists/kept.md"]!)).toBe("# Kept\n\n1. In a list\n   why\n");
  expect(strFromU8(zip["README.txt"]!)).toContain("pluck.json has everything");
});

test("bookmarks.html has every link under its Status, escaped, and reads back as the bookmarks import reads any browser's file", async () => {
  const { a, b } = await twoUsers();
  const note = 'Mind the <gap> & the "edge"';
  await importLink(a, "https://example.com/a?x=1&y=2", { title: `Tom & Jerry <b>"quoted"</b> it's`, tags: ["R&D", "to buy"], note, createdAt: new Date("2023-11-14T22:13:20.500Z") });
  await importLink(a, "https://example.com/b", { title: "京都の路地を歩く", tags: [], note: null, createdAt: new Date("2024-03-01T10:00:00Z") });
  await pluckLink(a, { url: "https://example.com/c", title: "Still to sort", source: "web" });
  await createTextItem(a, { kind: "note", text: "A Note has no URL", source: "web" });
  const exported = async (userId: string) => {
    await runExport(userId, await startExport(userId));
    return unzipSync(new Uint8Array(await getObject((await latestExport(userId))!.blobKey!)));
  };
  const zip = await exported(a);
  const html = strFromU8(zip["bookmarks.html"]!);

  // The round trip: the same URLs, titles, Tags and dates (to the second, all the format holds) as pluck.json has.
  const links = (JSON.parse(strFromU8(zip["pluck.json"]!)) as { items: { url: string | null; title: string; tags: string[]; createdAt: string }[] }).items.filter((i) => i.url);
  const row = (url: string, title: string | null, tags: string[], at: number) => JSON.stringify([url, title, tags, Math.floor(at / 1000)]);
  expect(links).toHaveLength(3);
  expect(parseImport("html", zip["bookmarks.html"]!).map((e) => row(e.url, e.title, e.tags, e.createdAt!.getTime())).sort())
    .toEqual(links.map((i) => row(i.url!, i.title, i.tags, Date.parse(i.createdAt))).sort());

  expect(html).toContain(
    '<DT><A HREF="https://example.com/a?x=1&amp;y=2" ADD_DATE="1700000000" TAGS="R&amp;D,to buy">Tom &amp; Jerry &lt;b&gt;&quot;quoted&quot;&lt;/b&gt; it&#39;s</A>\n        <DD>Mind the &lt;gap&gt; &amp; the &quot;edge&quot;\n',
  );
  const at = (text: string) => html.indexOf(text);
  expect(html.match(/<H3>[^<]*<\/H3>/g)).toEqual(["<H3>Inbox</H3>", "<H3>Archived</H3>"]); // no folder for a Status with no links
  expect(at("<H3>Inbox</H3>") < at("example.com/c") && at("example.com/c") < at("<H3>Archived</H3>") && at("<H3>Archived</H3>") < at("example.com/b")).toBe(true);
  expect(html).not.toContain("A Note has no URL");
  expect(strFromU8((await exported(b))["bookmarks.html"]!)).not.toContain("<DT>"); // nobody else's links
});
