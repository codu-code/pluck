import { createHash } from "node:crypto";
import type { ImportEntry } from "@pluck/extract";
import type { ImportStatus, Item } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { apiKeys, contents, db, emailAliases, exportsCol, highlights, imports, items, listRows, lists, oid, reports, tags, users, type ImportDoc } from "./collections.ts";
import { toItem } from "./items.ts";
import { textForSearch } from "./search.ts";
import { createTag } from "./tags.ts";

// ---- Imports ------------------------------------------------------------------------------------

const toImport = (d: ImportDoc): ImportStatus => ({
  id: d._id.toHexString(), source: d.source, total: d.total, done: d.done, failed: d.failed, state: d.state, error: d.error, createdAt: d.createdAt.toISOString(),
});

export async function createImport(userId: string, source: ImportDoc["source"], blobKey: string): Promise<ImportStatus> {
  const doc: ImportDoc = { _id: new ObjectId(), userId: oid(userId), source, blobKey, total: 0, done: 0, failed: 0, state: "waiting", error: null, createdAt: new Date() };
  await (await imports()).insertOne(doc);
  return toImport(doc);
}

export async function getImport(userId: string, id: string): Promise<(ImportStatus & { blobKey: string }) | null> {
  const doc = await (await imports()).findOne({ _id: oid(id), userId: oid(userId) });
  return doc && { ...toImport(doc), blobKey: doc.blobKey };
}

// Waiting → running, once: two clicks on Start (or two tabs) must not start two import chains.
export async function claimImportStart(userId: string, id: string): Promise<boolean> {
  return (await (await imports()).updateOne({ _id: oid(id), userId: oid(userId), state: "waiting" }, { $set: { state: "running" } })).modifiedCount === 1;
}

export async function updateImport(id: string, set: Partial<Pick<ImportDoc, "total" | "done" | "failed" | "state" | "error">>): Promise<void> {
  await (await imports()).updateOne({ _id: oid(id) }, { $set: set });
}

// One imported link. It goes to the Archive with reason "import" (Archive filter: Imported). A link already
// in the library is left exactly as it is. Tags are made by name; the person owns them.
// The tag counts are left to the caller (`recountTags` once a batch): counting per entry made a big import quadratic.
export async function importLink(userId: string, url: string, e: Pick<ImportEntry, "title" | "tags" | "note" | "createdAt">): Promise<{ item: Item; created: boolean; tagIds: string[] }> {
  const uid = oid(userId);
  const now = new Date();
  const urlHash = createHash("sha256").update(url).digest("hex");
  const res = await (await items()).findOneAndUpdate(
    { userId: uid, urlHash },
    {
      $setOnInsert: {
        userId: uid, kind: "link", url, urlHash, canonicalUrl: null, title: e.title?.trim() || url, titleIsDerived: true,
        siteName: new URL(url).hostname.replace(/^www\./, ""), author: null, excerpt: null, coverKey: null, htmlKey: null, status: "archived",
        archivedReason: "import", dueAt: null, tagIds: [], note: e.note?.trim() || null, source: "import", readingProgress: 0, wordCount: null, lang: null,
        extraction: { state: "pending", attempts: 0, lastError: null }, createdAt: e.createdAt ?? now, updatedAt: now, lastOpenedAt: null,
        lastTouchedAt: now, statusChangedAt: now, deletedAt: null, searchText: textForSearch({ url }),
      },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );
  const created = !res.lastErrorObject?.updatedExisting;
  let item = toItem(res.value!);
  const made = created ? await Promise.all(e.tags.slice(0, 20).map((name) => createTag(userId, name, "user"))) : [];
  const tagged = [...new Map(made.filter((t) => t !== null).map((t) => [t.tag.id, t])).values()]; // "DB" and "db" are one tag
  if (tagged.length) {
    const doc = await (await items()).findOneAndUpdate(
      { _id: res.value!._id },
      { $set: { tagIds: tagged.map((t) => oid(t.tag.id)), tagNames: tagged.map((t) => t.tag.name) } },
      { returnDocument: "after" },
    );
    item = toItem(doc!);
  }
  return { item, created, tagIds: tagged.map((t) => t.tag.id) };
}

// ---- Export -------------------------------------------------------------------------------------

export async function startExport(userId: string): Promise<string> {
  const _id = new ObjectId();
  await (await exportsCol()).insertOne({ _id, userId: oid(userId), state: "running", blobKey: null, createdAt: new Date() });
  return _id.toHexString();
}

export async function finishExport(id: string, blobKey: string | null): Promise<void> {
  await (await exportsCol()).updateOne({ _id: oid(id) }, { $set: { state: blobKey ? "done" : "failed", blobKey } });
}

export async function latestExport(userId: string): Promise<{ id: string; state: string; blobKey: string | null; createdAt: string } | null> {
  const d = await (await exportsCol()).find({ userId: oid(userId) }).sort({ createdAt: -1 }).limit(1).next();
  return d && { id: d._id.toHexString(), state: d.state, blobKey: d.blobKey, createdAt: d.createdAt.toISOString() };
}

// Everything a person has, for the export zip. Items in the bin are left out.
export async function exportData(userId: string) {
  const uid = oid(userId);
  const [itemDocs, contentDocs, tagDocs, listDocs, rowDocs, highlightDocs] = await Promise.all([
    (await items()).find({ userId: uid, deletedAt: null }, { projection: { searchBody: 0, searchText: 0, tagNames: 0, listNames: 0 } }).toArray(),
    (await contents()).find({ userId: uid }).toArray(),
    (await tags()).find({ userId: uid }).toArray(),
    (await lists()).find({ userId: uid }).toArray(),
    (await listRows()).find({ userId: uid }).sort({ position: 1 }).toArray(),
    (await highlights()).find({ userId: uid }).toArray(),
  ]);
  const text = new Map(contentDocs.map((c) => [c.itemId.toHexString(), c.textMarkdown]));
  const tagName = new Map(tagDocs.map((t) => [t._id.toHexString(), t.name]));
  return {
    items: itemDocs.map((d) => ({ ...toItem(d), tags: d.tagIds.map((t) => tagName.get(t.toHexString())).filter(Boolean) as string[], text: text.get(d._id.toHexString()) ?? null })),
    tags: tagDocs.map((t) => ({ id: t._id.toHexString(), name: t.name })),
    lists: listDocs.map((l) => ({
      id: l._id.toHexString(), name: l.name, slug: l.slug, purpose: l.purpose, visibility: l.visibility,
      items: rowDocs.filter((r) => r.listId.equals(l._id)).map((r) => ({ itemId: r.itemId.toHexString(), note: r.note, ticked: r.ticked })),
    })),
    highlights: highlightDocs.map((h) => ({ id: h._id.toHexString(), itemId: h.itemId.toHexString(), quote: h.quote, note: h.note, createdAt: h.createdAt.toISOString() })),
  };
}

// ---- Delete account -----------------------------------------------------------------------------

// Everything goes: items, text, tags, lists, highlights, keys, aliases, imports, exports, reports about
// their lists, and the auth rows. The caller removes the files under u/<userId>/.
export async function deleteAccountData(userId: string): Promise<void> {
  const uid = oid(userId);
  const d = await db();
  const listIds = (await (await lists()).find({ userId: uid }, { projection: { _id: 1 } }).toArray()).map((l) => l._id);
  await Promise.all([
    (await items()).deleteMany({ userId: uid }),
    (await contents()).deleteMany({ userId: uid }),
    (await tags()).deleteMany({ userId: uid }),
    (await lists()).deleteMany({ userId: uid }),
    (await listRows()).deleteMany({ userId: uid }),
    (await highlights()).deleteMany({ userId: uid }),
    (await apiKeys()).deleteMany({ userId: uid }),
    (await emailAliases()).deleteMany({ userId: uid }),
    (await imports()).deleteMany({ userId: uid }),
    (await exportsCol()).deleteMany({ userId: uid }),
    (await reports()).deleteMany({ listId: { $in: listIds } }),
    // Better Auth rows: its Mongo adapter stores userId as an ObjectId; cover the string form too.
    d.collection("auth_sessions").deleteMany({ userId: { $in: [uid, userId] } }),
    d.collection("auth_accounts").deleteMany({ userId: { $in: [uid, userId] } }),
    d.collection("oauthConsent").deleteMany({ userId: { $in: [uid, userId] } }),
    d.collection("oauthRefreshToken").deleteMany({ userId: { $in: [uid, userId] } }),
  ]);
  await (await users()).deleteOne({ _id: uid });
}
