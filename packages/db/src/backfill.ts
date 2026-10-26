import type { Preview } from "@pluck/shared-schemas";
import { items, meta } from "./collections.ts";

// Each pass walks every Item once, in _id order, so it never scans the whole collection. A new pass is how a better
// way of reading a link reaches the Items plucked before it; the next starts when the one before is done.
const PASSES: { key: string; wants: (previewGuess: Preview | null | undefined) => boolean }[] = [
  // Link Items read before Previews existed.
  { key: "backfill:previews", wants: (g) => g === undefined },
  // Posts and players again (October 2026): X Articles and links from X's embed JSON, TikTok captions, titles from a
  // post's own words.
  { key: "backfill:posts-2026-10", wants: (g) => g === "post" || g === "player" },
];

export type Unsorted = { userId: string; itemId: string; url: string; htmlKey: string | null };

// The next page of Items to read again, or null once every pass is done. Items plucked since are read as they come.
export async function nextUnsorted(limit = 25): Promise<Unsorted[] | null> {
  const m = await meta();
  for (const pass of PASSES) {
    const at = await m.findOne({ _id: pass.key });
    if (at?.done) continue;
    const docs = await (await items())
      .find(at?.after ? { _id: { $gt: at.after } } : {}, { projection: { userId: 1, url: 1, kind: 1, htmlKey: 1, previewGuess: 1, deletedAt: 1, "extraction.state": 1 } })
      .sort({ _id: 1 })
      .limit(limit)
      .toArray();
    const last = docs.at(-1);
    await m.updateOne({ _id: pass.key }, { $set: last ? { at: new Date(), after: last._id } : { at: new Date(), done: true } }, { upsert: true });
    if (!last) continue;
    return docs
      .filter((d) => pass.wants(d.previewGuess) && d.url && (d.kind === "link" || d.kind === "video") && !d.deletedAt && d.extraction.state === "done")
      .map((d) => ({ userId: d.userId.toHexString(), itemId: d._id.toHexString(), url: d.url!, htmlKey: d.htmlKey }));
  }
  return null;
}
