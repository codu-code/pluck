import { readFileSync } from "node:fs";
import { join } from "node:path";
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
