import type { Highlight } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { highlights, items, oid, type HighlightDoc } from "./collections.ts";

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
  return doc && toHighlight(doc);
}

export async function deleteHighlight(userId: string, id: string): Promise<boolean> {
  return (await (await highlights()).deleteOne({ _id: oid(id), userId: oid(userId) })).deletedCount === 1;
}
