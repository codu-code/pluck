import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as blob from "@pluck/blob";
import { exportData, pendingJobCount } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import type { ImportSource } from "@pluck/shared-schemas";
import { expect, test, vi } from "vitest";
import { runQueue } from "../job-runner";
import { beginImport, importStatus, runImport, startImport } from "./index";

vi.mock("@pluck/blob", async (real) => {
  const actual = await real<typeof import("@pluck/blob")>();
  return { ...actual, getObject: vi.fn(actual.getObject) };
});

const CSV = "url,title\nhttps://example.com/one,One\nhttps://example.com/two,Two\n";
const fixture = (name: string) => new Uint8Array(readFileSync(join(import.meta.dirname, "../../../../packages/extract/fixtures/imports", name)));
async function uploaded(userId: string, source: ImportSource, body: string | Uint8Array<ArrayBuffer>) {
  const begin = await beginImport(userId, source, body.length);
  expect((await fetch(begin.uploadUrl, { method: "PUT", headers: { "content-type": begin.contentType }, body })).ok).toBe(true);
  await startImport(userId, begin.import.id);
  return begin.import.id;
}
const run = async () => {
  await makeJobsVisible();
  // The real runner, on the import queue only: the links' own fetches stay queued.
  await runQueue({ import: (p) => runImport(String(p.userId), String(p.importId)) }, { queue: "import" });
};

test("a storage hiccup reading the file does not fail the import: the job is tried again", async () => {
  const { a } = await twoUsers();
  const id = await uploaded(a, "pocket", CSV);
  vi.mocked(blob.getObject).mockRejectedValueOnce(new Error("socket hang up"));
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "running", error: null, done: 0 });
  expect(await pendingJobCount("import")).toBe(1); // queued again, not given up on
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "done", total: 2, done: 2 });
});

test("the uploaded file goes once the import is done, or has failed for good", async () => {
  const { a } = await twoUsers();
  const done = await uploaded(a, "pocket", CSV);
  const failed = await uploaded(a, "omnivore", "not a zip");
  expect(await blob.listKeys(`u/${a}/imports/`)).toHaveLength(2);
  await run();
  expect([(await importStatus(a, done)).state, (await importStatus(a, failed)).state]).toEqual(["done", "failed"]);
  expect(await blob.listKeys(`u/${a}/imports/`)).toEqual([]);
});

// What an import of each app's fixture leaves in the library, oldest first: title, Tags, note, the day it was first kept.
const link = (path: string) => `https://example.com/${path}`;
const FROM: [ImportSource, string, number, [title: string, tags: string[], note: string | null, createdAt: string][]][] = [
  ["instapaper", "instapaper.csv", 4, [
    ['Small teams ship, when the "list" is short', ["work", "teams"], 'The part about "one list", quoted', "2023-11-14T22:13:20.000Z"],
    [link("window-functions"), [], null, "2023-11-14T22:15:00.000Z"],
    ["京都の路地を歩く", ["Travel", "japan"], null, "2023-11-14T22:16:40.000Z"],
  ]],
  ["readwise", "readwise.csv", 4, [
    ["Привет из архива", ["it's long", "reading"], null, "2022-12-07T07:43:11.000Z"],
    ['Indexes, queries and "plans"', ["postgres", "db"], null, "2023-11-14T22:13:20.043Z"],
    [link("rates"), [], null, "2023-11-14T22:15:00.000Z"],
  ]],
  ["wallabag", "wallabag.json", 4, [
    ["Albums of ordinary days", ["family", "photos"], null, "2023-11-14T22:13:20.000Z"],
    [link("gone"), [], null, "2023-11-15T09:00:00.000Z"],
    ["Η τέχνη της ανάγνωσης", ["ανάγνωση"], null, "2024-03-01T10:00:00.000Z"],
  ]],
  ["linkwarden", "linkwarden.json", 5, [
    [link("untitled"), [], null, "2019-05-06T07:08:09.000Z"],
    ['Estimating rates, "roughly"', [], null, "2024-02-01T10:00:00.000Z"],
    ["Kitchen hob", ["Reno", "kitchen", "to buy"], "Check the width against the worktop", "2024-03-01T10:00:00.000Z"],
    ["주방 조명 고르기", ["Reno"], null, "2024-03-02T10:00:00.000Z"],
  ]],
  ["karakeep", "karakeep.json", 4, [
    ['Drop D, slowly: "the" riff', ["guitar", "practice", "Music"], "Bars 9 to 16 first", "2023-11-14T22:13:20.000Z"],
    [link("untitled"), [], null, "2023-11-14T22:15:00.000Z"],
    ["أوتار الجيتار", ["Music"], null, "2023-11-14T22:18:20.000Z"],
  ]],
];

test.each(FROM)("an import from %s makes its links Items in the Archive, with their Tags, notes and dates; a link in the file twice is one Item", async (source, name, total, expected) => {
  const { a, b } = await twoUsers();
  const id = await uploaded(a, source, fixture(name));
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "done", total, done: total, failed: 0 });
  const made = [];
  for await (const page of (await exportData(a)).items) made.push(...page);
  made.sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  expect(made.map((i) => [i.title, i.tags, i.note, i.createdAt])).toEqual(expected);
  expect(made.every((i) => i.status === "archived" && i.archivedReason === "import" && i.source === "import")).toBe(true);
  // Wallabag's export carries the page, which is kept as it comes; where Wallabag had only its failed-fetch notice, the page is fetched.
  if (source === "wallabag") expect(made.map((i) => i.text?.includes("Every printed photograph") ?? false)).toEqual([true, false, false]);
  for await (const page of (await exportData(b)).items) expect(page).toEqual([]); // nobody else's library
});

test("a file from another app than the one picked fails as unreadable, and makes nothing", async () => {
  const { a } = await twoUsers();
  const id = await uploaded(a, "karakeep", fixture("wallabag.json"));
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "failed", error: "That file could not be read. Check it is the export from the right service.", total: 0 });
  for await (const page of (await exportData(a)).items) expect(page).toEqual([]);
});
