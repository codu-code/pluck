import type { Highlight, HighlightPage, HighlightsQuery } from "@pluck/shared-schemas";
import { ObjectId, type Filter } from "mongodb";
import { highlights, items, oid, type HighlightDoc, type ItemDoc } from "./collections.ts";
import { escape, syncHighlightText } from "./search.ts";

const toHighlight = (d: HighlightDoc): Highlight => ({
  id: d._id.toHexString(),
  itemId: d.itemId.toHexString(),
  quote: d.quote,
  note: d.note,
  selector: d.selector,
  createdAt: d.createdAt.toISOString(),
});

export type HighlightInput = { itemId: string; quote: string; note?: string | null; selector: HighlightDoc["selector"] };

// Highlights belong to link items only (notes have none). Highlighting is a touch.
// Every write here ends with syncHighlightText, so search_items finds an Item by what was highlighted in it.
export async function createHighlight(userId: string, input: HighlightInput): Promise<Highlight | null> {
  const uid = oid(userId);
  const itemId = oid(input.itemId);
  const now = new Date();
  const item = await (await items()).findOneAndUpdate(
    { _id: itemId, userId: uid, kind: { $in: ["link", "video", "pdf", "image"] }, deletedAt: null },
    { $set: { lastTouchedAt: now } },
  );
  if (!item) return null;
  const doc: HighlightDoc = {
    _id: new ObjectId(), userId: uid, itemId, quote: input.quote, note: input.note?.trim() || null, selector: input.selector, createdAt: now,
  };
  await (await highlights()).insertOne(doc);
  await syncHighlightText(uid, itemId);
  return toHighlight(doc);
}

export async function listHighlights(userId: string, itemId: string): Promise<Highlight[]> {
  const docs = await (await highlights()).find({ userId: oid(userId), itemId: oid(itemId) }).sort({ createdAt: 1 }).toArray();
  return docs.map(toHighlight);
}

export async function updateHighlight(userId: string, id: string, note: string | null): Promise<Highlight | null> {
  const doc = await (await highlights()).findOneAndUpdate(
    { _id: oid(id), userId: oid(userId) },
    { $set: { note: note?.trim() || null } },
    { returnDocument: "after" },
  );
  if (doc) await syncHighlightText(doc.userId, doc.itemId);
  return doc && toHighlight(doc);
}

export async function deleteHighlight(userId: string, id: string): Promise<boolean> {
  const doc = await (await highlights()).findOneAndDelete({ _id: oid(id), userId: oid(userId) });
  if (doc) await syncHighlightText(doc.userId, doc.itemId);
  return !!doc;
}

// One person's highlights across their library, newest first, each with the Item it is in. Highlights of an Item in
// the bin are left out. `more` says there is another page after this one.
// shortcut: `query` is a substring match over the person's highlights, read under the userId index (fine to tens of thousands, and it works in Japanese and Chinese, where $text does not), a text index on highlights when it is not.
export async function findHighlights(userId: string, q: HighlightsQuery): Promise<HighlightPage> {
  const uid = oid(userId);
  const match: Filter<HighlightDoc> = { userId: uid };
  if (q.itemId) match.itemId = oid(q.itemId);
  if (q.since) match.createdAt = { $gte: new Date(q.since) };
  // Every word, anywhere in the quote or the note.
  if (q.query) match.$and = q.query.split(/\s+/).filter(Boolean).map((word) => ({ $or: [{ quote: { $regex: escape(word), $options: "i" } }, { note: { $regex: escape(word), $options: "i" } }] }));
  const docs = await (await highlights())
    .aggregate<HighlightDoc & { item: Pick<ItemDoc, "_id" | "title" | "url" | "siteName"> }>([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      { $lookup: { from: "items", localField: "itemId", foreignField: "_id", pipeline: [{ $match: { userId: uid, deletedAt: null } }, { $project: { title: 1, url: 1, siteName: 1 } }], as: "item" } },
      { $unwind: "$item" }, // no Item out of the bin, no row
      { $skip: q.offset },
      { $limit: q.limit + 1 },
    ])
    .toArray();
  return {
    highlights: docs.slice(0, q.limit).map((d) => ({
      id: d._id.toHexString(), quote: d.quote, note: d.note, createdAt: d.createdAt.toISOString(),
      item: { id: d.item._id.toHexString(), title: d.item.title, url: d.item.url, siteName: d.item.siteName },
    })),
    more: docs.length > q.limit,
  };
}

// One-off: highlights made before they were searched get folded into their Items. Safe to run again.
export async function foldAllHighlights(): Promise<number> {
  const pairs = await (await highlights()).aggregate<{ _id: { userId: ObjectId; itemId: ObjectId } }>([{ $group: { _id: { userId: "$userId", itemId: "$itemId" } } }]).toArray();
  for (const { _id } of pairs) await syncHighlightText(_id.userId, _id.itemId);
  return pairs.length;
}
