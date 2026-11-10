import { getObject, listKeys } from "@pluck/blob";
import { createList, createTextItem, latestExport, startExport } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
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
