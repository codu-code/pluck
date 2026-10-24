import type { Item, List, ListEntry, ListMembership } from "@pluck/shared-schemas";
import { ObjectId, type Filter } from "mongodb";
import { items, LEAN, listRows, lists, oid, users, type ItemDoc, type ListDoc, type ListItemDoc } from "./collections.ts";
import { toItem } from "./items.ts";
import { slugify } from "./tags.ts";

const GAP = 1024;
type Actor = "user" | "mcp";

const toList = (d: ListDoc): List => ({
  id: d._id.toHexString(), name: d.name, slug: d.slug, purpose: d.purpose, visibility: d.visibility, itemCount: d.itemCount,
  tickedCount: d.tickedCount, views: d.views, lastAddedAt: d.lastAddedAt?.toISOString() ?? null, lastActivityAt: d.lastActivityAt.toISOString(),
  createdBy: d.createdBy, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
});

// Counts cover live items only (not ones in the bin), so "5 of 9" matches what the list shows.
export async function recountList(listId: ObjectId): Promise<void> {
  const [r] = await (await listRows())
    .aggregate<{ n: number; t: number }>([
      { $match: { listId } },
      { $lookup: { from: "items", localField: "itemId", foreignField: "_id", as: "item", pipeline: [{ $match: { deletedAt: null } }, { $project: { _id: 1 } }] } },
      { $match: { "item.0": { $exists: true } } },
      { $group: { _id: null, n: { $sum: 1 }, t: { $sum: { $cond: ["$ticked", 1, 0] } } } },
    ])
    .toArray();
  await (await lists()).updateOne({ _id: listId }, { $set: { itemCount: r?.n ?? 0, tickedCount: r?.t ?? 0 } });
}

// Every list an item is in, for when the item changes (bin, restore, purge).
export async function recountListsOf(itemIds: ObjectId[]): Promise<void> {
  const ids = await (await listRows()).distinct("listId", { itemId: { $in: itemIds } });
  for (const id of ids) await recountList(id);
}

// Items carry the names of their lists for search.
export async function syncListNames(userId: ObjectId, itemIds: ObjectId[]): Promise<void> {
  if (!itemIds.length) return;
  const rows = await (await listRows()).find({ userId, itemId: { $in: itemIds } }, { projection: { itemId: 1, listId: 1 } }).toArray();
  const names = new Map(
    (await (await lists()).find({ _id: { $in: [...new Set(rows.map((r) => r.listId.toHexString()))].map(oid) } }).toArray()).map((l) => [l._id.toHexString(), l.name]),
  );
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.itemId.toHexString(), [...(by.get(r.itemId.toHexString()) ?? []), names.get(r.listId.toHexString()) ?? ""]);
  await (await items()).bulkWrite(
    itemIds.map((id) => ({ updateOne: { filter: { _id: id, userId }, update: { $set: { listNames: (by.get(id.toHexString()) ?? []).filter(Boolean) } } } })),
  );
}

async function uniqueSlug(userId: ObjectId, name: string, except?: ObjectId): Promise<string> {
  const base = slugify(name) || "list";
  const col = await lists();
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await col.findOne({ userId, slug, ...(except ? { _id: { $ne: except } } : {}) }, { projection: { _id: 1 } }))) return slug;
  }
}

export type NewList = { name: string; purpose?: string; createdBy: Actor; items?: { itemId: string; note?: string | null }[] };

// A new list is always private. Items passed in keep their order, each with an optional note.
export async function createList(userId: string, input: NewList): Promise<List> {
  const uid = oid(userId);
  const now = new Date();
  const doc: ListDoc = {
    _id: new ObjectId(), userId: uid, name: input.name.trim().slice(0, 120), slug: await uniqueSlug(uid, input.name), purpose: input.purpose?.trim() ?? "",
    visibility: "private", itemCount: 0, tickedCount: 0, views: 0, lastAddedAt: null, lastActivityAt: now, createdBy: input.createdBy, createdAt: now,
    updatedAt: now,
  };
  try {
    await (await lists()).insertOne(doc);
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    doc.slug = await uniqueSlug(uid, `${input.name} ${now.getTime().toString(36)}`);
    await (await lists()).insertOne(doc);
  }
  for (const it of input.items ?? []) await addToList(userId, doc._id.toHexString(), [it.itemId], { note: it.note ?? null, by: input.createdBy });
  return toList((await (await lists()).findOne({ _id: doc._id }))!);
}

export async function listLists(userId: string): Promise<List[]> {
  return (await (await lists()).find({ userId: oid(userId) }).sort({ lastActivityAt: -1 }).toArray()).map(toList);
}

export async function getListMeta(userId: string, listId: string): Promise<List | null> {
  const doc = await (await lists()).findOne({ _id: oid(listId), userId: oid(userId) });
  return doc && toList(doc);
}

// One list in order, with each entry's note and tick and the item itself. Items in the bin are hidden.
export async function getList(userId: string, listId: string): Promise<{ list: List; entries: ListEntry[] } | null> {
  const uid = oid(userId);
  const doc = await (await lists()).findOne({ _id: oid(listId), userId: uid });
  if (!doc) return null;
  const rows = await (await listRows()).find({ listId: doc._id, userId: uid }).sort({ position: 1 }).toArray();
  const byId = new Map(
    (await (await items()).find({ _id: { $in: rows.map((r) => r.itemId) }, userId: uid, deletedAt: null }, LEAN).toArray()).map((i) => [i._id.toHexString(), i]),
  );
  const entries: ListEntry[] = [];
  for (const r of rows) {
    const item = byId.get(r.itemId.toHexString());
    if (item) entries.push({ item: toItem(item) as Item, note: r.note, noteBy: r.noteBy, ticked: r.ticked, position: r.position, addedAt: r.addedAt.toISOString() });
  }
  return { list: toList(doc), entries };
}

export type ListEdit = { name?: string; purpose?: string };

export async function updateList(userId: string, listId: string, edit: ListEdit): Promise<List | null> {
  const uid = oid(userId);
  const _id = oid(listId);
  const set: Partial<ListDoc> = { updatedAt: new Date(), lastActivityAt: new Date() };
  if (edit.purpose !== undefined) set.purpose = edit.purpose.trim();
  if (edit.name !== undefined) {
    set.name = edit.name.trim().slice(0, 120);
    // Once a list has been public its link is out there: the slug stays put.
    const current = await (await lists()).findOne({ _id, userId: uid }, { projection: { publishedAt: 1 } });
    if (!current?.publishedAt) set.slug = await uniqueSlug(uid, edit.name, _id);
  }
  const doc = await (await lists()).findOneAndUpdate({ _id, userId: uid }, { $set: set }, { returnDocument: "after" });
  if (doc && edit.name !== undefined) await syncListNames(uid, await (await listRows()).distinct("itemId", { listId: _id }));
  return doc && toList(doc);
}

// The items stay; only the list and its rows go.
export async function deleteList(userId: string, listId: string): Promise<boolean> {
  const uid = oid(userId);
  const _id = oid(listId);
  const res = await (await lists()).deleteOne({ _id, userId: uid });
  if (!res.deletedCount) return false;
  const itemIds = await (await listRows()).distinct("itemId", { listId: _id });
  await (await listRows()).deleteMany({ listId: _id, userId: uid });
  await syncListNames(uid, itemIds);
  return true;
}

// Adds items to the end (or at `position`). Already there is a no-op for that item. Adding is a touch.
export async function addToList(
  userId: string,
  listId: string,
  itemIds: string[],
  { note = null, position, by }: { note?: string | null; position?: number; by: Actor },
): Promise<number | null> {
  const uid = oid(userId);
  const _id = oid(listId);
  if (!(await (await lists()).findOne({ _id, userId: uid }))) return null;
  const owned = (await (await items()).find({ _id: { $in: itemIds.map(oid) }, userId: uid, deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  const ordered = itemIds.map(oid).filter((id) => owned.some((o) => o.equals(id)));
  if (!ordered.length) return 0;
  const col = await listRows();
  const last = await col.find({ listId: _id }).sort({ position: -1 }).limit(1).next();
  let pos = position ?? (last ? last.position + GAP : GAP);
  const now = new Date();
  let added = 0;
  for (const itemId of ordered) {
    const res = await col.updateOne(
      { userId: uid, itemId, listId: _id },
      {
        $setOnInsert: {
          position: pos, note: note?.trim() || null, noteBy: note?.trim() ? by : null, ticked: false, tickedAt: null, addedBy: by, addedAt: now,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) {
      added++;
      pos += GAP;
    }
  }
  await (await items()).updateMany({ _id: { $in: ordered }, userId: uid }, { $set: { lastTouchedAt: now } });
  await (await lists()).updateOne({ _id }, { $set: { lastAddedAt: now, lastActivityAt: now, updatedAt: now } });
  await recountList(_id);
  await syncListNames(uid, ordered);
  return added;
}

export async function removeFromList(userId: string, listId: string, itemId: string): Promise<boolean> {
  const uid = oid(userId);
  const _id = oid(listId);
  const res = await (await listRows()).deleteOne({ listId: _id, userId: uid, itemId: oid(itemId) });
  if (!res.deletedCount) return false;
  await (await lists()).updateOne({ _id }, { $set: { lastActivityAt: new Date() } });
  await recountList(_id);
  await syncListNames(uid, [oid(itemId)]);
  return true;
}

export type EntryEdit = { note?: string | null; ticked?: boolean; position?: number };

export async function updateEntry(userId: string, listId: string, itemId: string, edit: EntryEdit, by: Actor): Promise<boolean> {
  const uid = oid(userId);
  const _id = oid(listId);
  const set: Partial<ListItemDoc> = {};
  if (edit.note !== undefined) {
    set.note = edit.note?.trim() || null;
    set.noteBy = set.note ? by : null;
  }
  if (edit.ticked !== undefined) {
    set.ticked = edit.ticked;
    set.tickedAt = edit.ticked ? new Date() : null;
  }
  if (edit.position !== undefined) set.position = edit.position;
  const res = await (await listRows()).updateOne({ listId: _id, userId: uid, itemId: oid(itemId) }, { $set: set });
  if (!res.matchedCount) return false;
  await (await lists()).updateOne({ _id }, { $set: { lastActivityAt: new Date() } });
  if (edit.ticked !== undefined) await recountList(_id);
  if (edit.position !== undefined) await renumberIfCrowded(_id);
  return true;
}

// Floats between neighbours make a drag one write; when two get too close, the list is renumbered.
async function renumberIfCrowded(listId: ObjectId): Promise<void> {
  const rows = await (await listRows()).find({ listId }, { projection: { position: 1 } }).sort({ position: 1 }).toArray();
  const crowded = rows.some((r, i) => i > 0 && r.position - rows[i - 1]!.position < 1e-6);
  if (!crowded) return;
  await (await listRows()).bulkWrite(rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { position: (i + 1) * GAP } } } })));
}

// The full order in one call. The ids must be exactly the list's items.
export async function reorderList(userId: string, listId: string, itemIds: string[]): Promise<boolean> {
  const uid = oid(userId);
  const _id = oid(listId);
  const col = await listRows();
  const rows = await col.find({ listId: _id, userId: uid }, { projection: { itemId: 1 } }).toArray();
  const have = new Set(rows.map((r) => r.itemId.toHexString()));
  if (have.size !== itemIds.length || itemIds.some((id) => !have.has(id))) return false;
  await col.bulkWrite(itemIds.map((id, i) => ({ updateOne: { filter: { listId: _id, itemId: oid(id) }, update: { $set: { position: (i + 1) * GAP } } } })));
  await (await lists()).updateOne({ _id }, { $set: { lastActivityAt: new Date() } });
  return true;
}

// The lists an item is in, with its place and note in each (the item page's "In 2 lists").
export async function listsForItem(userId: string, itemId: string): Promise<ListMembership[]> {
  const uid = oid(userId);
  const rows = await (await listRows()).find({ userId: uid, itemId: oid(itemId) }).toArray();
  const out: ListMembership[] = [];
  for (const r of rows) {
    const list = await (await lists()).findOne({ _id: r.listId, userId: uid });
    if (!list) continue;
    const place = (await (await listRows()).countDocuments({ listId: r.listId, position: { $lt: r.position } })) + 1;
    out.push({ list: toList(list), place, note: r.note, noteBy: r.noteBy, ticked: r.ticked });
  }
  return out.sort((a, b) => b.list.lastActivityAt.localeCompare(a.list.lastActivityAt));
}

// Items in any list are exempt from expiry (used by the expiry job and Archive it all).
export async function inAnyList(userId: ObjectId): Promise<Filter<ItemDoc>> {
  const ids = await (await listRows()).distinct("itemId", { userId });
  return { _id: { $nin: ids } };
}

export type VisibilityResult = { ok: true; list: List } | { ok: false; reason: "not_found" | "handle_required" | "closed" };

// Public needs a handle, and an account an admin has closed cannot publish.
export async function setVisibility(userId: string, listId: string, visibility: "private" | "public"): Promise<VisibilityResult> {
  const uid = oid(userId);
  const _id = oid(listId);
  const col = await lists();
  const list = await col.findOne({ _id, userId: uid });
  if (!list) return { ok: false, reason: "not_found" };
  if (visibility === "public") {
    const owner = await (await users()).findOne({ _id: uid }, { projection: { handle: 1, publicKilled: 1 } });
    if (owner?.publicKilled || list.killed) return { ok: false, reason: "closed" };
    if (!owner?.handle) return { ok: false, reason: "handle_required" };
  }
  const now = new Date();
  const doc = await col.findOneAndUpdate(
    { _id },
    { $set: { visibility, updatedAt: now, lastActivityAt: now, ...(visibility === "public" && !list.publishedAt ? { publishedAt: now } : {}) } },
    { returnDocument: "after" },
  );
  return { ok: true, list: toList(doc!) };
}

export async function listOwnedBy(listId: string, userId: string): Promise<boolean> {
  return Boolean(await (await lists()).findOne({ _id: oid(listId), userId: oid(userId) }, { projection: { _id: 1 } }));
}
