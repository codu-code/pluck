import { items, meta } from "./collections.ts";

const KEY = "backfill:previews";

export type Unsorted = { userId: string; itemId: string; url: string; htmlKey: string | null };

// Link Items read before Previews existed, a page at a time in _id order, so it never scans the whole collection.
// Returns null once it has been through every Item; Items plucked since get their Preview when they are read.
export async function nextUnsorted(limit = 25): Promise<Unsorted[] | null> {
  const m = await (await meta()).findOne({ _id: KEY });
  if (m?.done) return null;
  const docs = await (await items())
    .find(m?.after ? { _id: { $gt: m.after } } : {}, { projection: { userId: 1, url: 1, kind: 1, htmlKey: 1, previewGuess: 1, deletedAt: 1, "extraction.state": 1 } })
    .sort({ _id: 1 })
    .limit(limit)
    .toArray();
  const last = docs.at(-1);
  await (await meta()).updateOne({ _id: KEY }, { $set: last ? { at: new Date(), after: last._id } : { at: new Date(), done: true } }, { upsert: true });
  if (!last) return null;
  return docs
    .filter((d) => d.previewGuess === undefined && d.url && (d.kind === "link" || d.kind === "video") && !d.deletedAt && d.extraction.state === "done")
    .map((d) => ({ userId: d.userId.toHexString(), itemId: d._id.toHexString(), url: d.url!, htmlKey: d.htmlKey }));
}
