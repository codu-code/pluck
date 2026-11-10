import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { expect, test } from "vitest";
import { parseCsv, parseImport } from "./imports.ts";

const file = (name: string) => new Uint8Array(readFileSync(join(import.meta.dirname, "../fixtures/imports", name)));

test("CSV handles quotes, doubled quotes and newlines in fields", () => {
  expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([{ a: "x, y", b: 'say "hi"\nthere' }]);
});

test("Pocket: urls, titles, | tags and dates; non-links dropped", () => {
  const e = parseImport("pocket", file("pocket.csv"));
  expect(e.map((x) => x.url)).toEqual(["https://example.com/small-teams", "https://example.com/window-functions", "https://example.com/quoted"]);
  expect(e[0]).toMatchObject({ title: "Small teams ship when the list is short", tags: ["work", "teams"] });
  expect(e[0]!.createdAt?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  expect(e[2]!.title).toBe('A quote "inside" the title');
});

test("Raindrop: notes with newlines and comma tags", () => {
  const e = parseImport("raindrop", file("raindrop.csv"));
  expect(e[0]).toMatchObject({ url: "https://example.com/hob", title: "Kitchen hob", note: "Check the width\nagainst the worktop", tags: ["kitchen", "to buy"] });
});

test("bookmarks HTML: links with tags and dates, place: entries dropped, entities decoded", () => {
  const e = parseImport("html", file("bookmarks.html"));
  expect(e.map((x) => x.title)).toEqual(["Indexes & queries", "Estimating rates", "Don't panic: &lt;b&gt; is “bold”"]); // each entity decoded once
  expect(e[0]!.tags).toEqual(["postgres", "db"]);
});

test("Omnivore: metadata plus the kept page when the zip has it", () => {
  const e = parseImport("omnivore", file("omnivore.zip"));
  expect(e).toHaveLength(2);
  expect(e[0]).toMatchObject({ url: "https://example.com/albums", tags: ["family"] });
  expect(e[0]!.html?.()).toContain("Every printed photograph");
  expect(e[1]!.html).toBeNull();
});

test("Omnivore: a zip that unpacks too large is refused before it is unpacked", () => {
  const meta = strToU8(JSON.stringify([{ url: "https://example.com/a", slug: "a" }]));
  const big = new Uint8Array(21_000_000); // zeros: a few kilobytes zipped
  const e = parseImport("omnivore", zipSync({ "metadata_0.json": meta, "content/a.html": big }));
  expect(e[0]!.html).toBeNull(); // a page too big to keep is fetched instead
  expect(() => parseImport("omnivore", zipSync({ "metadata_0.json": big }))).toThrow(/too large/);
  const many = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`metadata_${i}.json`, big.subarray(0, 19_000_000)]));
  expect(() => parseImport("omnivore", zipSync(many))).toThrow(/too large/);
});

test("Instapaper: a folder becomes a tag, where it sat does not; JSON tags, the selection as the note, Unix dates", () => {
  const e = parseImport("instapaper", file("instapaper.csv"));
  expect(e.map((x) => x.url)).toEqual(["https://example.com/small-teams", "https://example.com/window-functions", "https://example.com/kyoto", "https://example.com/small-teams"]);
  expect(e[0]).toMatchObject({ title: 'Small teams ship, when the "list" is short', note: 'The part about "one list", quoted', tags: ["work", "teams"] });
  expect(e[0]!.createdAt?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  expect(e[1]).toMatchObject({ title: null, note: null, tags: [] }); // Archive is not a folder
  expect(e[2]).toMatchObject({ title: "京都の路地を歩く", tags: ["Travel", "japan"] });
  expect(e[3]!.tags).toEqual([]); // nor is Starred
  // An export from before the Timestamp and Tags columns, and a Tags cell that is not a list.
  expect(parseImport("instapaper", strToU8("URL,Title,Selection,Folder\nhttps://example.com/old,Old,,Unread\n"))[0]).toMatchObject({ title: "Old", tags: [], createdAt: null });
  expect(parseImport("instapaper", strToU8('URL,Title,Selection,Folder,Timestamp,Tags\nhttps://example.com/odd,Odd,,Unread,1700000000,"{""a"": 1"\n'))[0]!.tags).toEqual([]);
});
