import { ObjectId } from "mongodb";
import { expect, test } from "vitest";
import { getDb } from "./client.ts";
import {
  aliasOf, createApiKey, createHighlight, createList, createTextItem, deleteAccountData, exportData, claimImportStart, createImport, getImport, getItem, importLink, updateImport, listApiKeys, recountTags,
  listTags, pluckLink, revokeApiKey, verifyApiKey, analyticsOf, countItems, getMe, setHeardFrom, setVia, updateSettings, finishExport, latestExport, startExport, sweepTransfers,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

test("API keys: shown once, stored as a hash, verified, per person, revoked", async () => {
  const { a, b } = await twoUsers();
  const { key, apiKey } = await createApiKey(a, "iPhone Shortcut");
  expect(key).toMatch(/^pk_live_[a-f0-9]{32}$/);
  expect(apiKey.prefix).toBe(key.slice(8, 14));
  const stored = await getDb().collection("apiKeys").findOne({ name: "iPhone Shortcut" });
  expect(JSON.stringify(stored)).not.toContain(key.slice(8));
  expect(await verifyApiKey(key)).toEqual({ userId: a, scopes: ["library:read", "library:write"] });
  expect((await listApiKeys(a))[0]?.lastUsedAt).not.toBeNull();
  expect(await verifyApiKey(`${key}x`)).toBeNull();
  expect(await revokeApiKey(b, apiKey.id)).toBe(false);
  expect(await revokeApiKey(a, apiKey.id)).toBe(true);
  expect(await verifyApiKey(key)).toBeNull();
});

test("imports land in the Archive as imported, keep tags, and never disturb what is already there", async () => {
  const { a } = await twoUsers();
  const mine = (await pluckLink(a, { url: "https://example.com/already", source: "web" })).item;
  const fresh = await importLink(a, "https://example.com/new", { title: "New one", tags: ["postgres", "db"], note: "from Pocket", createdAt: new Date("2023-01-01") });
  expect(fresh.created).toBe(true);
  expect(fresh.item).toMatchObject({ status: "archived", archivedReason: "import", source: "import", title: "New one", note: "from Pocket" });
  expect(fresh.item.createdAt).toBe("2023-01-01T00:00:00.000Z");
  expect(fresh.item.tagIds).toHaveLength(2);
  await recountTags(a, fresh.tagIds);
  expect((await listTags(a)).map((t) => [t.name, t.count]).sort()).toEqual([["db", 1], ["postgres", 1]]);
  expect((await getItem(a, fresh.item.id))?.tagIds).toHaveLength(2);
  const again = await importLink(a, "https://example.com/already", { title: "Other", tags: ["x"], note: null, createdAt: null });
  expect(again.created).toBe(false);
  expect(await getItem(a, mine.id)).toMatchObject({ status: "inbox", title: "https://example.com/already", tagIds: [] });
});

test("an import starts once, and only for its owner", async () => {
  const { a, b } = await twoUsers();
  const imp = await createImport(a, "pocket", "u/x/imports/y.csv");
  expect(await claimImportStart(b, imp.id)).toBe(false);
  expect(await Promise.all([claimImportStart(a, imp.id), claimImportStart(a, imp.id)])).toEqual(expect.arrayContaining([true, false]));
  expect((await getImport(a, imp.id))?.state).toBe("running");
});

test("the daily sweep takes old imports that are not running and exports past their link, and nothing newer", async () => {
  const { a, b } = await twoUsers();
  const d = getDb();
  const aged = async (collection: string, id: string, days: number) =>
    void (await d.collection(collection).updateOne({ _id: ObjectId.createFromHexString(id) }, { $set: { createdAt: new Date(Date.now() - days * 86_400_000) } }));
  const neverStarted = await createImport(a, "pocket", "imports/never-started");
  const finished = await createImport(b, "pocket", "imports/finished");
  await claimImportStart(b, finished.id);
  await updateImport(finished.id, { state: "done" });
  const running = await createImport(a, "pocket", "imports/running");
  await claimImportStart(a, running.id);
  for (const i of [neverStarted, finished, running]) await aged("imports", i.id, 2);
  const fresh = await createImport(b, "pocket", "imports/fresh"); // uploaded a moment ago, not started yet
  const oldExport = await startExport(a);
  await finishExport(oldExport, "exports/old");
  await aged("exports", oldExport, 9);
  const liveExport = await startExport(b);
  await finishExport(liveExport, "exports/live");
  await aged("exports", liveExport, 6); // its emailed link still works

  const removed: string[] = [];
  expect(await sweepTransfers(new Date(), async (key) => void removed.push(key))).toBe(3);
  expect(removed.sort()).toEqual(["exports/old", "imports/finished", "imports/never-started"]);
  expect([await getImport(a, neverStarted.id), await getImport(b, finished.id), await latestExport(a)]).toEqual([null, null, null]);
  expect((await getImport(a, running.id))?.state).toBe("running");
  expect((await getImport(b, fresh.id))?.state).toBe("waiting");
  expect((await latestExport(b))?.blobKey).toBe("exports/live");
});

test("export gathers everything; delete removes one person entirely and leaves the other", async () => {
  const { a, b } = await twoUsers();
  const link = (await pluckLink(a, { url: "https://example.com/e", source: "web" })).item;
  await createTextItem(a, { kind: "note", text: "Note body", source: "web" });
  await createList(a, { name: "Mine", createdBy: "user", items: [{ itemId: link.id, note: "first" }] });
  await createHighlight(a, { itemId: link.id, quote: "q", selector: { textQuote: { exact: "q", prefix: "", suffix: "" }, textPosition: { start: 0, end: 1 } } });
  await createApiKey(a, "k");
  await aliasOf(a);
  const { item: theirs } = await createTextItem(b, { kind: "note", text: "Theirs", source: "web" });

  const data = await exportData(a, 1); // a page of one: the two Items come as two pages, and none of B's
  const pages = [];
  for await (const page of data.items) pages.push(page);
  expect(pages.map((p) => p.length)).toEqual([1, 1]);
  expect(pages.flat().find((i) => i.kind === "note")?.text).toBe("Note body");
  expect(data.lists[0]!.items).toEqual([{ itemId: link.id, note: "first", ticked: false }]);
  expect(data.highlights).toHaveLength(1);

  await deleteAccountData(a);
  const d = getDb();
  const uid = ObjectId.createFromHexString(a);
  for (const c of ["items", "contents", "lists", "listItems", "highlights", "apiKeys", "emailAliases", "tags"]) expect(await d.collection(c).countDocuments({ userId: uid })).toBe(0);
  expect(await d.collection("users").countDocuments({ _id: uid })).toBe(0);
  expect(await getItem(b, theirs.id)).not.toBeNull();
});

test("the analytics answer and where the account began are per person, and via is written once", async () => {
  const { a, b } = await twoUsers();
  await updateSettings(a, { analytics: "yes" });
  await setVia(a, "try");
  await setVia(a, "direct");
  expect(await analyticsOf(a)).toMatchObject({ consent: "yes", via: "try" });
  expect(await analyticsOf(b)).toMatchObject({ consent: null, via: null });
  expect((await getMe(a))?.settings.analytics).toBe("yes");
  await pluckLink(a, { url: "https://example.com/counted", source: "web" });
  expect([await countItems(a), await countItems(b)]).toEqual([1, 0]);
  expect(await setHeardFrom(a, "friend")).toBe(true);
  expect(await setHeardFrom(a, "search")).toBe(false); // the first answer stays
  expect([(await getMe(a))?.heardFrom, (await getMe(b))?.heardFrom]).toEqual(["friend", null]);
});

test("the newest analytics answer wins: an older one from an offline device does not undo it, and it never lapses", async () => {
  const { a, b } = await twoUsers();
  const now = Date.now();
  await updateSettings(a, { analytics: "no", analyticsAt: now - 1000 });
  await updateSettings(a, { analytics: "yes", analyticsAt: now - 5000 }); // answered earlier, saved later
  expect(await analyticsOf(a)).toMatchObject({ consent: "no" });
  await updateSettings(a, { analytics: "yes", analyticsAt: now + 86_400_000 }); // dated ahead: kept as now, so it can still change
  expect((await getMe(a))?.settings.analyticsAt).toBeLessThanOrEqual(Date.now());
  await updateSettings(a, { analytics: "no" });
  expect(await analyticsOf(a)).toMatchObject({ consent: "no" });
  expect((await getMe(b))?.settings).toMatchObject({ analytics: null, analyticsAt: null });
  await updateSettings(b, { analytics: "yes", analyticsAt: now - 366 * 86_400_000 }); // a year and more ago: still the answer
  expect(await analyticsOf(b)).toMatchObject({ consent: "yes" });
});
