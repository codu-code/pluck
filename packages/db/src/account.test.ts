import { ObjectId } from "mongodb";
import { expect, test } from "vitest";
import { getDb } from "./client.ts";
import {
  aliasOf, createApiKey, createHighlight, createList, createTextItem, deleteAccountData, exportData, claimImportStart, createImport, getImport, getItem, importLink, listApiKeys, recountTags,
  listTags, pluckLink, revokeApiKey, verifyApiKey,
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

test("export gathers everything; delete removes one person entirely and leaves the other", async () => {
  const { a, b } = await twoUsers();
  const link = (await pluckLink(a, { url: "https://example.com/e", source: "web" })).item;
  await createTextItem(a, { kind: "note", text: "Note body", source: "web" });
  await createList(a, { name: "Mine", createdBy: "user", items: [{ itemId: link.id, note: "first" }] });
  await createHighlight(a, { itemId: link.id, quote: "q", selector: { textQuote: { exact: "q", prefix: "", suffix: "" }, textPosition: { start: 0, end: 1 } } });
  await createApiKey(a, "k");
  await aliasOf(a);
  const theirs = await createTextItem(b, { kind: "note", text: "Theirs", source: "web" });

  const data = await exportData(a);
  expect(data.items).toHaveLength(2);
  expect(data.items.find((i) => i.kind === "note")?.text).toBe("Note body");
  expect(data.lists[0]!.items).toEqual([{ itemId: link.id, note: "first", ticked: false }]);
  expect(data.highlights).toHaveLength(1);

  await deleteAccountData(a);
  const d = getDb();
  const uid = ObjectId.createFromHexString(a);
  for (const c of ["items", "contents", "lists", "listItems", "highlights", "apiKeys", "emailAliases", "tags"]) expect(await d.collection(c).countDocuments({ userId: uid })).toBe(0);
  expect(await d.collection("users").countDocuments({ _id: uid })).toBe(0);
  expect(await getItem(b, theirs.id)).not.toBeNull();
});
