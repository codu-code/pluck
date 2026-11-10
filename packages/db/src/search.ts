import { createHash } from "node:crypto";
import { normalizeUrl, type Item, type SearchHit, type SearchQuery } from "@pluck/shared-schemas";
import type { Filter, ObjectId } from "mongodb";
import { highlights, items, listRows, oid, tags, type ItemDoc } from "./collections.ts";
import { toItem } from "./items.ts";

// Text search over title (10), note and tags (5), list names (3), site, excerpt and highlights (2) and the kept text (1).
// One $text index on items; the kept text is copied onto the item, capped, so one query ranks everything.

const BODY_CAP = 32_000;
const HIGHLIGHTS_CAP = 8_000;
const HIGHLIGHTS_MARK = "\n\v\n"; // where an Item's highlights begin in its searchText: all before it belongs to textForSearch

export const bodyForSearch = (text: string) => text.slice(0, BODY_CAP);

export function textForSearch(p: { url?: string | null; excerpt?: string | null; siteName?: string | null; author?: string | null }): string {
  const host = p.url ? new URL(p.url).hostname.replace(/^www\./, "") : null;
  return [p.excerpt, p.siteName, host, p.author].filter(Boolean).join(" · ");
}

// An Item's highlights as they sit at the end of its searchText, after the excerpt, site and author and never in their
// place. The person's notes go first: they are their own words and kept nowhere else, while most quotes are in the
// kept text too.
// shortcut: highlights past 8,000 characters an Item are not searched (list_highlights still finds them), their own text index when people highlight that much.
export async function highlightsForSearch(userId: ObjectId, itemId: ObjectId): Promise<string> {
  const docs = await (await highlights()).find({ userId, itemId }, { projection: { quote: 1, note: 1 } }).sort({ createdAt: 1 }).toArray();
  const text = [...docs.map((h) => h.note), ...docs.map((h) => h.quote)].filter(Boolean).join(" · ").slice(0, HIGHLIGHTS_CAP);
  return text && HIGHLIGHTS_MARK + text;
}

// Keeps an Item's searchText in step after its highlights change: what textForSearch wrote stays as it is.
export async function syncHighlightText(userId: ObjectId, itemId: ObjectId): Promise<void> {
  const own = { $arrayElemAt: [{ $split: [{ $ifNull: ["$searchText", ""] }, HIGHLIGHTS_MARK] }, 0] };
  await (await items()).updateOne({ _id: itemId, userId }, [{ $set: { searchText: { $concat: [own, { $literal: await highlightsForSearch(userId, itemId) }] } } }]);
}

// Keeps items' tag names in step after tags change. `filter` picks the items to refresh.
export async function syncTagNames(userId: ObjectId, filter: Filter<ItemDoc>): Promise<void> {
  const col = await items();
  const docs = await col.find({ ...filter, userId }, { projection: { tagIds: 1 } }).toArray();
  if (!docs.length) return;
  const names = new Map((await (await tags()).find({ userId }).toArray()).map((t) => [t._id.toHexString(), t.name]));
  await col.bulkWrite(
    docs.map((d) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { tagNames: d.tagIds.map((t) => names.get(t.toHexString())).filter((n): n is string => !!n) } } },
    })),
  );
}

// Japanese, Chinese and Korean: $text splits on spaces and punctuation, so it finds nothing inside their sentences.
const CJK = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/u;
const SEARCHED = ["title", "note", "tagNames", "listNames", "searchText", "searchBody"] as const;
export const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const terms = (q: string) =>
  q.toLowerCase().replace(/["'“”]/g, " ").split(/\s+/).filter((t) => (t.length > 1 || CJK.test(t)) && !t.startsWith("-"));

// The kept text is markdown: a snippet shows its words, not the image links and marks around them.
const plain = (md: string) =>
  md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|__|`|^#+ /gm, "").trim();

// The best snippet: the person's note first, then the kept text, then the excerpt. The hit is the matched term.
export function snippetFor(doc: Pick<ItemDoc, "note" | "searchBody" | "excerpt">, q: string): SearchHit["snippet"] {
  const words = terms(q);
  const sources = [
    ["note", doc.note],
    ["body", doc.searchBody],
    ["excerpt", doc.excerpt],
  ] as const;
  for (const [source, raw] of sources) {
    if (!raw) continue;
    const text = plain(raw);
    const lower = text.toLowerCase();
    let best: { at: number; len: number } | null = null;
    // Prefer the whole query as a phrase, then any single term.
    const phrase = words.join(" ");
    const phraseAt = phrase.includes(" ") ? lower.indexOf(phrase) : -1;
    if (phraseAt >= 0) best = { at: phraseAt, len: phrase.length };
    else
      for (const w of words) {
        const at = CJK.test(w) ? lower.indexOf(w) : lower.search(new RegExp(`\\b${escape(w)}`)); // no \b inside a CJK sentence
        if (at >= 0 && (!best || at < best.at)) best = { at, len: w.length };
      }
    if (!best) continue;
    // Cut at a space, or at a fixed length where there is none near (Japanese and Chinese have no spaces).
    const start = Math.max(0, best.at - 120, text.lastIndexOf(" ", Math.max(0, best.at - 90)) + 1);
    const endAt = text.indexOf(" ", Math.min(text.length, best.at + best.len + 110));
    const end = Math.min(endAt < 0 ? text.length : endAt, best.at + best.len + 140);
    const clip = (s: string) => s.replace(/\s+/g, " ");
    return {
      source,
      pre: (start > 0 ? "…" : "") + clip(text.slice(start, best.at)),
      hit: clip(text.slice(best.at, best.at + best.len)),
      post: clip(text.slice(best.at + best.len, end)) + (end < text.length ? "…" : ""),
    };
  }
  return null;
}

const encode = (offset: number) => Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
const decode = (s?: string) => {
  try {
    return s ? (JSON.parse(Buffer.from(s, "base64url").toString()) as { o: number }).o : 0;
  } catch {
    return 0;
  }
};

export async function searchItems(userId: string, q: SearchQuery): Promise<{ results: SearchHit[]; total: number; nextCursor: string | null }> {
  const uid = oid(userId);
  const col = await items();
  const filter: Filter<ItemDoc> = { userId: uid, deletedAt: null };
  if (q.status) filter.status = q.status;
  if (q.kinds?.length) filter.kind = { $in: q.kinds };
  if (q.tagIds?.length) filter.tagIds = { $all: q.tagIds.map(oid) };
  if (q.listId) filter._id = { $in: await (await listRows()).distinct("itemId", { userId: uid, listId: oid(q.listId) }) };
  if (q.since || q.until) filter.createdAt = { ...(q.since ? { $gte: new Date(q.since) } : {}), ...(q.until ? { $lt: new Date(q.until) } : {}) };
  // A query with Japanese, Chinese or Korean in it matches by substring instead: every term, anywhere in the six fields,
  // newest first.
  // shortcut: this reads the person's whole library for such a query (fine to tens of thousands of Items), a bigram field in the text index when it is not.
  const cjk = CJK.test(q.q);
  const text: Filter<ItemDoc> = cjk
    ? { ...filter, $and: q.q.split(/\s+/).filter(Boolean).map((term) => ({ $or: SEARCHED.map((f) => ({ [f]: { $regex: escape(term), $options: "i" } })) })) }
    : { ...filter, $text: { $search: q.q } };
  const offset = decode(q.cursor);
  const lean = { searchText: 0, tagNames: 0, listNames: 0 } as const;

  // A pasted URL finds its item first, even when the words in it match nothing. It is kept out of the other hits on
  // every page, so it is shown once (on the first) and counted once.
  const key = normalizeUrl(q.q);
  const exact = key ? await col.findOne({ ...filter, urlHash: createHash("sha256").update(key).digest("hex") }, { projection: lean }) : null;
  const rest: Filter<ItemDoc> = exact ? { $and: [text, { _id: { $ne: exact._id } }] } : text;
  const [docs, total] = await Promise.all([
    (cjk
      ? col.find(rest, { projection: lean }).sort({ createdAt: -1, _id: -1 })
      : col.find(rest, { projection: { score: { $meta: "textScore" }, ...lean } }).sort({ score: { $meta: "textScore" }, createdAt: -1 })
    )
      .skip(offset)
      .limit(q.limit + 1)
      .toArray(),
    col.countDocuments(rest),
  ]);
  const hits: SearchHit[] = docs.slice(0, q.limit).map((d) => ({ item: toItem(d) as Item, snippet: snippetFor(d, q.q) }));
  if (exact && offset === 0) hits.unshift({ item: toItem(exact), snippet: null });
  return {
    results: hits,
    total: total + (exact ? 1 : 0),
    nextCursor: docs.length > q.limit ? encode(offset + q.limit) : null,
  };
}
