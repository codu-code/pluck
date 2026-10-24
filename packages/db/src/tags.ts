import type { Tag } from "@pluck/shared-schemas";
import { ObjectId, type UpdateFilter } from "mongodb";
import type { ItemDoc } from "./collections.ts";
import { syncTagNames } from "./search.ts";
import { items, oid, tags, type TagDoc } from "./collections.ts";

// Muted colours for the dot beside a tag in Settings, handed out in order.
const COLOURS = ["#34A07C", "#5B7FA6", "#C27A3A", "#7C6A9E", "#B8A44A", "#5E8C6A", "#A65B6E", "#4E8A99"];

export function slugify(name: string): string {
  return name.trim().toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const toTag = (d: TagDoc, aiCount = 0): Tag => ({
  id: d._id.toHexString(), name: d.name, slug: d.slug, colour: d.colour, count: d.count, aiCount, createdBy: d.createdBy,
  createdAt: d.createdAt.toISOString(),
});

// Item counts are recomputed for the tags a change touched, so they never drift.
async function recount(userId: ObjectId, tagIds: ObjectId[]): Promise<void> {
  const col = await items();
  const t = await tags();
  await Promise.all(
    tagIds.map(async (tagId) => t.updateOne({ _id: tagId, userId }, { $set: { count: await col.countDocuments({ userId, tagIds: tagId, deletedAt: null }) } })),
  );
}

export async function recountTags(userId: string, tagIds: string[]): Promise<void> {
  await recount(oid(userId), [...new Set(tagIds)].map(oid));
}

// The vocabulary, most used first, with how many of each tag's assignments came from an AI tool.
export async function listTags(userId: string): Promise<Tag[]> {
  const uid = oid(userId);
  const [docs, ai] = await Promise.all([
    (await tags()).find({ userId: uid }).sort({ count: -1, name: 1 }).toArray(),
    (await items())
      .aggregate<{ _id: ObjectId; n: number }>([
        { $match: { userId: uid, deletedAt: null, "aiTags.0": { $exists: true } } },
        { $unwind: "$aiTags" },
        { $group: { _id: "$aiTags.tagId", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const aiBy = new Map(ai.map((a) => [a._id.toHexString(), a.n]));
  return docs.map((d) => toTag(d, aiBy.get(d._id.toHexString()) ?? 0));
}

// Idempotent on the slug: asking for an existing tag returns it.
export async function createTag(userId: string, name: string, createdBy: "user" | "mcp"): Promise<{ tag: Tag; created: boolean } | null> {
  const uid = oid(userId);
  const slug = slugify(name);
  if (!slug) return null;
  const col = await tags();
  const existing = await col.findOne({ userId: uid, slug });
  if (existing) return { tag: toTag(existing), created: false };
  const doc: TagDoc = {
    _id: new ObjectId(), userId: uid, name: name.trim().slice(0, 40), slug, colour: COLOURS[(await col.countDocuments({ userId: uid })) % COLOURS.length]!,
    count: 0, createdAt: new Date(), createdBy,
  };
  try {
    await col.insertOne(doc);
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    return { tag: toTag((await col.findOne({ userId: uid, slug }))!), created: false };
  }
  return { tag: toTag(doc), created: true };
}

// Renaming makes the tag the person's own. A name that belongs to another tag is a conflict (merge instead).
export async function renameTag(userId: string, id: string, name: string): Promise<Tag | "conflict" | null> {
  const uid = oid(userId);
  const slug = slugify(name);
  if (!slug) return null;
  const col = await tags();
  const clash = await col.findOne({ userId: uid, slug, _id: { $ne: oid(id) } });
  if (clash) return "conflict";
  const doc = await col.findOneAndUpdate(
    { _id: oid(id), userId: uid },
    { $set: { name: name.trim().slice(0, 40), slug, createdBy: "user" } },
    { returnDocument: "after" },
  );
  if (doc) await syncTagNames(uid, { tagIds: doc._id });
  return doc && toTag(doc);
}

// Deleting a tag either moves its items to another tag (a merge) or just takes it off them.
export async function deleteTag(userId: string, id: string, opts: { reassignTo: string } | { removeFromItems: true }): Promise<boolean> {
  const uid = oid(userId);
  const tagId = oid(id);
  const t = await tags();
  if (!(await t.findOne({ _id: tagId, userId: uid }))) return false;
  const col = await items();
  let target: ObjectId | null = null;
  if ("reassignTo" in opts) {
    target = oid(opts.reassignTo);
    if (target.equals(tagId) || !(await t.findOne({ _id: target, userId: uid }))) return false;
    await col.updateMany({ userId: uid, tagIds: tagId }, { $addToSet: { tagIds: target } });
  }
  const affected = (await col.find({ userId: uid, tagIds: tagId }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  await col.updateMany({ userId: uid, tagIds: tagId }, { $pull: { tagIds: tagId, aiTags: { tagId } } });
  await t.deleteOne({ _id: tagId, userId: uid });
  if (target) await recount(uid, [target]);
  await syncTagNames(uid, { _id: { $in: affected } });
  return true;
}

// Turns what a caller sent (tag ids, or names for convenience) into the person's tag ids. Never creates.
export async function resolveTags(userId: string, values: string[]): Promise<{ ids: string[]; unknown: string[] }> {
  const uid = oid(userId);
  const all = await (await tags()).find({ userId: uid }, { projection: { _id: 1, slug: 1 } }).toArray();
  const byId = new Map(all.map((t) => [t._id.toHexString(), t._id.toHexString()]));
  const bySlug = new Map(all.map((t) => [t.slug, t._id.toHexString()]));
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const v of values) {
    const id = byId.get(v) ?? bySlug.get(slugify(v));
    if (id) ids.push(id);
    else unknown.push(v);
  }
  return { ids: [...new Set(ids)], unknown };
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

// The closest existing tags to something that is not a tag: by spelling for names, by use for bad ids.
export async function nearestTags(userId: string, value: string, n = 5): Promise<{ id: string; name: string }[]> {
  const all = await (await tags()).find({ userId: oid(userId) }).sort({ count: -1 }).toArray();
  const slug = slugify(value);
  const ranked = ObjectId.isValid(value) || !slug ? all : [...all].sort((a, b) => distance(slug, a.slug) - distance(slug, b.slug));
  return ranked.slice(0, n).map((t) => ({ id: t._id.toHexString(), name: t.name }));
}

// Sets one item's tags. By the person: the whole set, and every tag on it becomes theirs.
// By an AI tool: new ones are marked so they show "by AI" and can be removed in bulk.
export async function setItemTags(userId: string, itemId: string, tagIds: string[], by: "user" | "mcp"): Promise<boolean> {
  const uid = oid(userId);
  const col = await items();
  const current = await col.findOne({ _id: oid(itemId), userId: uid, deletedAt: null });
  if (!current) return false;
  const next = tagIds.map(oid);
  const now = new Date();
  const added = next.filter((t) => !current.tagIds.some((c) => c.equals(t)));
  const aiTags =
    by === "user"
      ? []
      : [...(current.aiTags ?? []).filter((a) => next.some((t) => t.equals(a.tagId))), ...added.map((tagId) => ({ tagId, at: now }))];
  await col.updateOne({ _id: current._id }, { $set: { tagIds: next, aiTags, lastTouchedAt: now, updatedAt: now } });
  await recount(uid, [...new Set([...current.tagIds, ...next].map((t) => t.toHexString()))].map(oid));
  await syncTagNames(uid, { _id: current._id });
  return true;
}

// Adds and removes tags across many items in two updates.
export async function batchTags(userId: string, itemIds: string[], add: string[], remove: string[], by: "user" | "mcp"): Promise<number> {
  const uid = oid(userId);
  const col = await items();
  const now = new Date();
  const filter = { userId: uid, _id: { $in: itemIds.map(oid) }, deletedAt: null };
  const addIds = add.map(oid);
  const removeIds = remove.map(oid);
  let modified = 0;
  if (addIds.length) {
    // An AI tool marks only the assignments it actually adds.
    for (const tagId of addIds) {
      const res = await col.updateMany(
        { ...filter, tagIds: { $ne: tagId } },
        { $addToSet: { tagIds: tagId }, ...(by === "mcp" ? { $push: { aiTags: { tagId, at: now } } } : {}), $set: { lastTouchedAt: now, updatedAt: now } },
      );
      modified += res.modifiedCount;
    }
  }
  if (removeIds.length) {
    // why: the driver's types cannot express $pull with $in on an ObjectId array.
    const update = {
      $pull: { tagIds: { $in: removeIds }, aiTags: { tagId: { $in: removeIds } } },
      $set: { lastTouchedAt: now, updatedAt: now },
    } as unknown as UpdateFilter<ItemDoc>;
    const res = await col.updateMany(filter, update);
    modified += res.modifiedCount;
  }
  await recount(uid, [...addIds, ...removeIds]);
  await syncTagNames(uid, { _id: { $in: itemIds.map(oid) } });
  return modified;
}

// "Remove everything AI tagged this week": undo every assignment an AI tool made in the window,
// then delete AI-made tags left with no items.
export async function purgeAiTags(userId: string, days: number): Promise<{ assignments: number; tags: number }> {
  const uid = oid(userId);
  const since = new Date(Date.now() - days * 86_400_000);
  const col = await items();
  const affected = await col.find({ userId: uid, aiTags: { $elemMatch: { at: { $gte: since } } } }).toArray();
  let assignments = 0;
  const touched = new Set<string>();
  for (const it of affected) {
    const recent = (it.aiTags ?? []).filter((a) => a.at >= since);
    assignments += recent.length;
    recent.forEach((a) => touched.add(a.tagId.toHexString()));
    // why: as above, $pull with $in is valid Mongo the driver types reject.
    await col.updateOne({ _id: it._id }, {
      $pull: { tagIds: { $in: recent.map((a) => a.tagId) }, aiTags: { at: { $gte: since } } },
    } as unknown as UpdateFilter<ItemDoc>);
  }
  const ids = [...touched].map(oid);
  await recount(uid, ids);
  await syncTagNames(uid, { _id: { $in: affected.map((it) => it._id) } });
  const t = await tags();
  const res = await t.deleteMany({ userId: uid, _id: { $in: ids }, createdBy: "mcp", count: 0 });
  return { assignments, tags: res.deletedCount };
}

export async function countAiTagged(userId: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [r] = await (await items())
    .aggregate<{ n: number }>([
      { $match: { userId: oid(userId), "aiTags.at": { $gte: since } } },
      { $unwind: "$aiTags" },
      { $match: { "aiTags.at": { $gte: since } } },
      { $count: "n" },
    ])
    .toArray();
  return r?.n ?? 0;
}
