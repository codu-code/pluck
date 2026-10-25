import { createHash } from "node:crypto";
import { BIN_DAYS, defaultPreview, deriveExcerpt, deriveTitle, isTextKind, LINK_KINDS, TEXT_KINDS, type Item, type ItemPage, type Facts, type Kind, type ListItemsQuery, type Preview, type Source, type Status, type TextKind } from "@pluck/shared-schemas";
import { ObjectId, type Filter } from "mongodb";
import { contents, highlights, items, LEAN, listRows, oid, type ItemDoc } from "./collections.ts";
import { markFollowsDone, recountList, recountListsOf } from "./lists.ts";
import { recountTags } from "./tags.ts";
import { bodyForSearch, textForSearch } from "./search.ts";

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
    preview: d.previewOverride ?? d.previewGuess ?? defaultPreview(d.kind),
    previewGuess: d.previewGuess ?? defaultPreview(d.kind),
    facts: d.facts ?? {},
    status: d.status,
    archivedReason: d.archivedReason,
    dueAt: iso(d.dueAt),
    tagIds: d.tagIds.map((t) => t.toHexString()),
    aiTagIds: (d.aiTags ?? []).map((t) => t.tagId.toHexString()),
    note: d.note,
    source: d.source,
    wordCount: d.wordCount,
    lang: d.lang,
    extraction: d.extraction,
    readingProgress: d.readingProgress,
    inList: Boolean(d.inList),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    lastTouchedAt: d.lastTouchedAt.toISOString(),
    statusChangedAt: (d.statusChangedAt ?? d.createdAt).toISOString(),
    deletedAt: iso(d.deletedAt),
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
        $set: { status: "inbox", archivedReason: null, deletedAt: null, lastTouchedAt: now, updatedAt: now, statusChangedAt: now },
        $setOnInsert: {
          userId: uid, kind: "link", url: input.url, urlHash: hash, canonicalUrl: null,
          title: input.title?.trim() || input.url, titleIsDerived: true, siteName: new URL(input.url).hostname.replace(/^www\./, ""),
          author: null, excerpt: null, coverKey: null, htmlKey: null, dueAt: null, tagIds: [], note: input.note?.trim() || null,
          source: input.source, readingProgress: 0, wordCount: null, lang: null,
          extraction: { state: "pending", attempts: 0, lastError: null }, createdAt: now, lastOpenedAt: null,
          searchText: textForSearch({ url: input.url }),
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
  // A page that failed before gets a fresh try, so the extract job does not skip it as settled.
  const retry = !created && doc.extraction.state === "failed";
  if (retry) {
    doc = (await col.findOneAndUpdate(
      { _id: doc._id, userId: uid },
      { $set: { extraction: { state: "pending", attempts: 0, lastError: null } } },
      { returnDocument: "after" },
    ))!;
  }
  // A re-pluck may have brought the item back from the bin, so its tags and lists count it again.
  if (!created) await recountAround(userId, doc);
  return { item: toItem(doc), created, needsExtraction: created || retry };
}

// Tag and List counts leave out the Bin, so any write that moves an Item in or out of it recounts both.
export const recountAround = (userId: string, doc: Pick<ItemDoc, "_id" | "tagIds">) =>
  Promise.all([recountTags(userId, doc.tagIds.map((t) => t.toHexString())), recountListsOf([doc._id])]);

// An Image or PDF shared as a file: no URL, the bytes arrive in blob storage and the worker reads them.
export async function createFileItem(userId: string, input: { kind: "image" | "pdf"; title: string; source: Source }): Promise<Item> {
  const now = new Date();
  const _id = new ObjectId();
  const col = await items();
  await col.insertOne({
    _id, userId: oid(userId), kind: input.kind, url: null, canonicalUrl: null, title: input.title, titleIsDerived: true, siteName: null,
    author: null, excerpt: null, coverKey: null, htmlKey: null, status: "inbox", archivedReason: null, dueAt: null, tagIds: [], note: null,
    source: input.source, readingProgress: 0, wordCount: null, lang: null, extraction: { state: "pending", attempts: 0, lastError: null },
    createdAt: now, updatedAt: now, lastOpenedAt: null, lastTouchedAt: now, statusChangedAt: now, deletedAt: null,
    searchText: textForSearch({}),
  });
  return toItem((await col.findOne({ _id }))!);
}

export type TextItemInput = { kind: TextKind; text: string; title?: string | null; dueAt?: Date | null; source: Source };

// A Note, Todo or Thing: no URL, no extraction, the body in contents with extractor "user".
export async function createTextItem(userId: string, input: TextItemInput): Promise<Item> {
  const now = new Date();
  const uid = oid(userId);
  const typed = input.title?.trim();
  const doc: ItemDoc = {
    _id: new ObjectId(), userId: uid, kind: input.kind, url: null, canonicalUrl: null,
    title: typed || deriveTitle(input.text), titleIsDerived: !typed, siteName: null, author: null,
    excerpt: deriveExcerpt(input.text, !typed), coverKey: null, htmlKey: null, status: "inbox", archivedReason: null,
    dueAt: input.dueAt ?? null, tagIds: [], note: null, source: input.source, readingProgress: 0, wordCount: null, lang: null,
    extraction: { state: "none", attempts: 0, lastError: null }, createdAt: now, updatedAt: now, lastOpenedAt: null,
    lastTouchedAt: now, statusChangedAt: now, deletedAt: null, searchBody: bodyForSearch(input.text),
  };
  await (await items()).insertOne(doc);
  await (await contents()).insertOne({
    _id: new ObjectId(), itemId: doc._id, userId: uid, textMarkdown: input.text, extractor: "user", bytes: Buffer.byteLength(input.text),
  });
  return toItem(doc);
}

export type ItemEdit = {
  title?: string; text?: string; kind?: Kind; dueAt?: Date | null; status?: Status; note?: string | null; readingProgress?: number;
  preview?: Preview | null; // the person's choice of screen; null goes back to the guess
};

// The fields a status change sets: archived by the person is "user"; leaving the archive clears the reason.
function statusFields(status: Status, now: Date): Partial<ItemDoc> {
  return { status, statusChangedAt: now, archivedReason: status === "archived" ? "user" : null };
}

// Edits by the person. Title rules: a typed title sticks; an empty one goes back to the first line.
// The caller has already checked the edit fits the item (text and text kinds only on items with no URL).
export async function editItem(userId: string, itemId: string, edit: ItemEdit): Promise<Item | null> {
  const uid = oid(userId);
  const _id = oid(itemId);
  const col = await items();
  const current = await col.findOne({ _id, userId: uid, deletedAt: null });
  if (!current) return null;
  const now = new Date();
  const set: Partial<ItemDoc> = { updatedAt: now, lastTouchedAt: now };
  let text: string | undefined = edit.text;
  if (edit.text !== undefined) {
    await (await contents()).updateOne(
      { itemId: _id, userId: uid },
      { $set: { textMarkdown: edit.text, extractor: "user", bytes: Buffer.byteLength(edit.text) } },
      { upsert: true },
    );
  } else if (edit.title !== undefined && isTextKind(current.kind)) {
    text = (await (await contents()).findOne({ itemId: _id, userId: uid }))?.textMarkdown ?? "";
  }
  let titleIsDerived = current.titleIsDerived;
  if (edit.title !== undefined) {
    const typed = edit.title.trim();
    titleIsDerived = !typed;
    set.titleIsDerived = titleIsDerived;
    if (typed) set.title = typed;
  }
  if (isTextKind(current.kind) && text !== undefined) {
    if (titleIsDerived) set.title = deriveTitle(text);
    set.excerpt = deriveExcerpt(text, titleIsDerived);
    set.searchBody = bodyForSearch(text);
  }
  if (edit.kind !== undefined) set.kind = edit.kind;
  if (edit.dueAt !== undefined) set.dueAt = edit.dueAt;
  if (edit.status !== undefined && edit.status !== current.status) Object.assign(set, statusFields(edit.status, now));
  if (edit.note !== undefined) set.note = edit.note?.trim() || null;
  if (edit.preview !== undefined) set.previewOverride = edit.preview;
  if (edit.readingProgress !== undefined) {
    // Scrolling is not a touch; only real edits keep an item from expiring.
    set.readingProgress = edit.readingProgress;
    if (Object.entries(edit).every(([k, v]) => k === "readingProgress" || v === undefined)) {
      delete set.lastTouchedAt;
      delete set.updatedAt;
    }
  }
  const doc = await col.findOneAndUpdate({ _id, userId: uid }, { $set: set }, { returnDocument: "after" });
  if (doc && set.status) await marksFollow(uid, [doc._id], set.status);
  return doc && toItem(doc);
}

// A Todo or Thing's mark in its Lists follows its Done (see markFollowsDone).
async function marksFollow(uid: ObjectId, ids: ObjectId[], status: Status): Promise<void> {
  if (status === "archived") return;
  const tasks = await (await items()).find({ _id: { $in: ids }, userId: uid, kind: { $in: ["todo", "thing"] } }, { projection: { _id: 1 } }).toArray();
  await markFollowsDone(uid, tasks.map((t) => t._id), status === "done");
}

export type BatchEdit = { status?: Status; kind?: Kind; dueAt?: Date | null; note?: string | null };

// One change over many of the person's items. Changes that do not fit an item are skipped for that item:
// Done only for todos and things, link kinds only for links, text kinds only for items with no URL.
export async function batchUpdate(userId: string, itemIds: string[], patch: BatchEdit): Promise<{ matched: number; updated: number }> {
  const col = await items();
  const now = new Date();
  const base = { userId: oid(userId), _id: { $in: itemIds.map(oid) }, deletedAt: null };
  const set: Partial<ItemDoc> = { updatedAt: now, lastTouchedAt: now };
  if (patch.dueAt !== undefined) set.dueAt = patch.dueAt;
  if (patch.note !== undefined) set.note = patch.note?.trim() || null;
  const filter: Record<string, unknown> = { ...base };
  if (patch.status) {
    Object.assign(set, statusFields(patch.status, now));
    if (patch.status === "done") filter.kind = { $in: ["todo", "thing"] };
  }
  if (patch.kind) {
    set.kind = patch.kind;
    // A link kind fits links (with or without a URL, like email-in); a text kind fits notes, todos and things.
    const group: readonly string[] = (LINK_KINDS as readonly string[]).includes(patch.kind) ? LINK_KINDS : TEXT_KINDS;
    filter.kind = { $in: (patch.status === "done" ? group.filter((k) => k === "todo" || k === "thing") : group) as Kind[] };
  }
  const matched = await col.countDocuments(base);
  const res = await col.updateMany(filter, { $set: set });
  if (patch.status) {
    const moved = await col.find({ ...base, status: patch.status }, { projection: { _id: 1 } }).toArray();
    await marksFollow(base.userId, moved.map((d) => d._id), patch.status);
  }
  return { matched, updated: res.modifiedCount };
}

// Opening an item is a touch.
export async function markOpened(userId: string, itemId: string): Promise<void> {
  const now = new Date();
  await (await items()).updateOne({ _id: oid(itemId), userId: oid(userId), deletedAt: null }, { $set: { lastOpenedAt: now, lastTouchedAt: now } });
}

// The bin: deleted items wait 30 days, then purgeBin removes them for good.
export async function moveToBin(userId: string, itemId: string): Promise<boolean> {
  const doc = await (await items()).findOneAndUpdate({ _id: oid(itemId), userId: oid(userId), deletedAt: null }, { $set: { deletedAt: new Date() } });
  if (doc) await recountAround(userId, doc);
  return Boolean(doc);
}

export async function restoreFromBin(userId: string, itemId: string): Promise<Item | null> {
  const doc = await (await items()).findOneAndUpdate(
    { _id: oid(itemId), userId: oid(userId), deletedAt: { $ne: null } },
    { $set: { deletedAt: null, lastTouchedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (doc) await recountAround(userId, doc);
  return doc && toItem(doc);
}

export { BIN_DAYS }; // the number lives in shared-schemas so the web app's Bin view uses the same one

// Hard-deletes items that have been in the bin longer than 30 days, with their contents and highlights.
// `removeFiles` deletes their stored files before any row goes.
export async function purgeBin(
  now = new Date(),
  removeFiles: (prefixes: string[]) => Promise<void> = async () => {},
): Promise<{ purged: number; userIds: string[]; blobPrefixes: string[] }> {
  const col = await items();
  const cutoff = new Date(now.getTime() - BIN_DAYS * 86_400_000);
  const docs = await col.find({ deletedAt: { $lt: cutoff } }, { projection: { _id: 1, userId: 1 } }).toArray();
  if (!docs.length) return { purged: 0, userIds: [], blobPrefixes: [] };
  const blobPrefixes = docs.map((d) => `u/${d.userId.toHexString()}/items/${d._id.toHexString()}/`);
  // Files first: if that fails, the rows stay and tomorrow's run tries again. Rows gone first would leave the
  // files with nothing pointing at them.
  await removeFiles(blobPrefixes);
  const ids = docs.map((d) => d._id);
  await (await contents()).deleteMany({ itemId: { $in: ids } });
  await (await highlights()).deleteMany({ itemId: { $in: ids } });
  const listIds = await (await listRows()).distinct("listId", { itemId: { $in: ids } });
  await (await listRows()).deleteMany({ itemId: { $in: ids } });
  await col.deleteMany({ _id: { $in: ids }, deletedAt: { $lt: cutoff } });
  for (const id of listIds) await recountList(id);
  return { purged: docs.length, userIds: [...new Set(docs.map((d) => d.userId.toHexString()))], blobPrefixes };
}

export async function countItems(userId: string, status: Status): Promise<number> {
  return (await items()).countDocuments({ userId: oid(userId), status, deletedAt: null });
}

export type ExtractionResult = {
  kind: Kind;
  preview: Preview | null;
  facts: Facts;
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
        previewGuess: x.preview,
        facts: x.facts,
        // A title the user typed is never replaced by extraction.
        ...(current.titleIsDerived && x.title ? { title: x.title } : {}),
        siteName: x.siteName ?? current.siteName,
        author: x.author,
        excerpt: x.excerpt,
        canonicalUrl: x.canonicalUrl,
        lang: x.lang,
        wordCount: x.wordCount,
        searchText: textForSearch({ url: current.url, excerpt: x.excerpt, siteName: x.siteName ?? current.siteName, author: x.author }),
        searchBody: bodyForSearch(x.markdown),
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

// The live item for a normalised URL; binned ones do not count.
export async function findByUrl(userId: string, normalizedUrl: string): Promise<Item | null> {
  const doc = await (await items()).findOne({ userId: oid(userId), urlHash: urlHash(normalizedUrl), deletedAt: null }, LEAN);
  return doc && toItem(doc);
}

export async function getItem(userId: string, itemId: string): Promise<Item | null> {
  const doc = await (await items()).findOne({ _id: oid(itemId), userId: oid(userId), deletedAt: null }, LEAN);
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
// Views: a status, "archive" (archived and done, newest move first) or "bin" (deleted in the last 30 days).
export async function listItems(userId: string, q: ListItemsQuery): Promise<ItemPage> {
  const filter: Filter<ItemDoc> = { userId: oid(userId) };
  let field: "createdAt" | "lastTouchedAt" | "statusChangedAt" | "deletedAt" = q.sort === "untouched" ? "lastTouchedAt" : "createdAt";
  let dir: 1 | -1 = q.sort === "untouched" ? 1 : -1;
  if (q.status === "bin") {
    filter.deletedAt = { $gt: new Date(Date.now() - BIN_DAYS * 86_400_000) };
    field = "deletedAt";
    dir = -1;
  } else {
    filter.deletedAt = null;
    if (q.status === "archive") {
      field = "statusChangedAt";
      dir = -1;
      const f = q.archive ?? "all";
      if (f === "all") filter.status = { $in: ["archived", "done"] };
      else if (f === "you") filter.$or = [{ status: "done" }, { status: "archived", archivedReason: "user" }];
      else if (f === "expired") Object.assign(filter, { status: "archived", archivedReason: { $in: ["expired", "bulk"] } });
      else Object.assign(filter, { status: "archived", archivedReason: "import" });
    } else filter.status = q.status;
  }
  if (q.kinds?.length) filter.kind = { $in: q.kinds };
  if (q.tagId) filter.tagIds = oid(q.tagId);
  const cursor = decode(q.cursor);
  if (cursor?.v) {
    const v = new Date(cursor.v);
    const op = dir === -1 ? "$lt" : "$gt";
    const page = { $or: [{ [field]: { [op]: v } }, { [field]: v, _id: { [op]: oid(cursor.id) } }] };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, page];
      delete filter.$or;
    } else Object.assign(filter, page);
  }
  const docs = await (await items())
    .find(filter, LEAN)
    .sort({ [field]: dir, _id: dir })
    .limit(q.limit + 1)
    .toArray();
  const page = docs.slice(0, q.limit);
  const last = page.at(-1);
  const lastValue = last ? ((last[field] as Date | null) ?? last.createdAt) : null;
  return {
    items: page.map(toItem),
    nextCursor: docs.length > q.limit && last && lastValue ? encode({ v: lastValue.toISOString(), id: last._id.toHexString() }) : null,
  };
}

export { ObjectId };
