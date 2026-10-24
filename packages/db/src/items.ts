import { createHash } from "node:crypto";
import type { Item, ItemPage, Kind, ListItemsQuery, Source } from "@pluck/shared-schemas";
import { ObjectId, type Filter } from "mongodb";
import { contents, items, oid, type ItemDoc } from "./collections.ts";

export const urlHash = (normalizedUrl: string) => createHash("sha256").update(normalizedUrl).digest("hex");

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toItem(d: ItemDoc): Item {
  return {
    id: d._id.toHexString(),
    kind: d.kind,
    url: d.url,
    canonicalUrl: d.canonicalUrl,
    title: d.title,
    titleIsDerived: d.titleIsDerived,
    siteName: d.siteName,
    author: d.author,
    excerpt: d.excerpt,
    hasCover: Boolean(d.coverKey),
    status: d.status,
    archivedReason: d.archivedReason,
    dueAt: iso(d.dueAt),
    tagIds: d.tagIds.map((t) => t.toHexString()),
    note: d.note,
    source: d.source,
    wordCount: d.wordCount,
    lang: d.lang,
    extraction: d.extraction,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    lastTouchedAt: d.lastTouchedAt.toISOString(),
  };
}

export type PluckLinkInput = { url: string; title?: string | null; note?: string | null; source: Source };

// Plucks a URL (already normalised). A URL already in the library is a re-pluck: the same item
// moves back to the Inbox, comes out of the bin and is touched. Never a second item.
export async function pluckLink(
  userId: string,
  input: PluckLinkInput,
): Promise<{ item: Item; created: boolean; needsExtraction: boolean }> {
  const col = await items();
  const now = new Date();
  const uid = oid(userId);
  const hash = urlHash(input.url);
  const run = () =>
    col.findOneAndUpdate(
      { userId: uid, urlHash: hash },
      {
        $set: { status: "inbox", archivedReason: null, deletedAt: null, lastTouchedAt: now, updatedAt: now },
        $setOnInsert: {
          userId: uid, kind: "link", url: input.url, urlHash: hash, canonicalUrl: null,
          title: input.title?.trim() || input.url, titleIsDerived: true, siteName: new URL(input.url).hostname.replace(/^www\./, ""),
          author: null, excerpt: null, coverKey: null, htmlKey: null, dueAt: null, tagIds: [], note: input.note?.trim() || null,
          source: input.source, readingProgress: 0, wordCount: null, lang: null,
          extraction: { state: "pending", attempts: 0, lastError: null }, createdAt: now, lastOpenedAt: null,
        },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
  let res;
  try {
    res = await run();
  } catch (e) {
    // Two plucks of the same URL at once: the loser retries and finds the winner's item.
    if ((e as { code?: number }).code !== 11000) throw e;
    res = await run();
  }
  let doc = res.value!;
  const created = !res.lastErrorObject?.updatedExisting;
  const note = input.note?.trim();
  if (!created && note && doc.note !== note) {
    doc = (await col.findOneAndUpdate(
      { _id: doc._id, userId: uid },
      { $set: { note: doc.note ? `${doc.note}\n\n${note}` : note } },
      { returnDocument: "after" },
    ))!;
  }
  return { item: toItem(doc), created, needsExtraction: created || doc.extraction.state === "failed" };
}

export type ExtractionResult = {
  kind: Kind;
  title: string | null;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  canonicalUrl: string | null;
  lang: string | null;
  wordCount: number;
  markdown: string;
  extractor: string;
};

export async function applyExtraction(userId: string, itemId: string, x: ExtractionResult): Promise<Item | null> {
  const uid = oid(userId);
  const _id = oid(itemId);
  const col = await items();
  const current = await col.findOne({ _id, userId: uid });
  if (!current) return null;
  await (await contents()).updateOne(
    { itemId: _id },
    { $set: { userId: uid, textMarkdown: x.markdown, extractor: x.extractor, bytes: Buffer.byteLength(x.markdown) } },
    { upsert: true },
  );
  const doc = await col.findOneAndUpdate(
    { _id, userId: uid },
    {
      $set: {
        kind: x.kind,
        // A title the user typed is never replaced by extraction.
        ...(current.titleIsDerived && x.title ? { title: x.title } : {}),
        siteName: x.siteName ?? current.siteName,
        author: x.author,
        excerpt: x.excerpt,
        canonicalUrl: x.canonicalUrl,
        lang: x.lang,
        wordCount: x.wordCount,
        extraction: { state: "done", attempts: current.extraction.attempts + 1, lastError: null },
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  return doc && toItem(doc);
}

// Records a failed attempt. `final` turns pending into failed; otherwise it stays pending for the retry queue.
export async function recordExtractionFailure(userId: string, itemId: string, error: string, final: boolean): Promise<Item | null> {
  const doc = await (await items()).findOneAndUpdate(
    { _id: oid(itemId), userId: oid(userId) },
    {
      $set: { "extraction.state": final ? "failed" : "pending", "extraction.lastError": error.slice(0, 500), updatedAt: new Date() },
      $inc: { "extraction.attempts": 1 },
    },
    { returnDocument: "after" },
  );
  return doc && toItem(doc);
}

export async function resetExtraction(userId: string, itemId: string): Promise<Item | null> {
  const doc = await (await items()).findOneAndUpdate(
    { _id: oid(itemId), userId: oid(userId), url: { $ne: null } },
    { $set: { extraction: { state: "pending", attempts: 0, lastError: null }, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc && toItem(doc);
}

export async function setBlobKeys(userId: string, itemId: string, keys: { coverKey?: string; htmlKey?: string }): Promise<void> {
  await (await items()).updateOne({ _id: oid(itemId), userId: oid(userId) }, { $set: { ...keys, updatedAt: new Date() } });
}

export async function getItem(userId: string, itemId: string): Promise<Item | null> {
  const doc = await (await items()).findOne({ _id: oid(itemId), userId: oid(userId), deletedAt: null });
  return doc && toItem(doc);
}

// Blob keys stay inside the server; routes use this to stream or sign them.
export async function getItemBlobKeys(userId: string, itemId: string): Promise<{ coverKey: string | null; htmlKey: string | null } | null> {
  const doc = await (await items()).findOne(
    { _id: oid(itemId), userId: oid(userId), deletedAt: null },
    { projection: { coverKey: 1, htmlKey: 1 } },
  );
  return doc && { coverKey: doc.coverKey, htmlKey: doc.htmlKey };
}

export async function getContent(userId: string, itemId: string): Promise<{ textMarkdown: string; extractor: string } | null> {
  const doc = await (await contents()).findOne({ itemId: oid(itemId), userId: oid(userId) });
  return doc && { textMarkdown: doc.textMarkdown, extractor: doc.extractor };
}

type Cursor = { v: string | null; id: string };
const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString()) as Cursor;
  } catch {
    return null;
  }
}

// Keyset pagination on (sort field, _id). Cursors are opaque to callers.
export async function listItems(userId: string, q: ListItemsQuery): Promise<ItemPage> {
  const field = q.sort === "untouched" ? "lastTouchedAt" : "createdAt";
  const dir = q.sort === "untouched" ? 1 : -1;
  const filter: Filter<ItemDoc> = { userId: oid(userId), status: q.status, deletedAt: null };
  if (q.kinds?.length) filter.kind = { $in: q.kinds };
  const cursor = decode(q.cursor);
  if (cursor?.v) {
    const v = new Date(cursor.v);
    const op = dir === -1 ? "$lt" : "$gt";
    filter.$or = [{ [field]: { [op]: v } }, { [field]: v, _id: { [op]: oid(cursor.id) } }];
  }
  const docs = await (await items())
    .find(filter)
    .sort({ [field]: dir, _id: dir })
    .limit(q.limit + 1)
    .toArray();
  const page = docs.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    nextCursor: docs.length > q.limit && last ? encode({ v: last[field].toISOString(), id: last._id.toHexString() }) : null,
  };
}

export { ObjectId };
