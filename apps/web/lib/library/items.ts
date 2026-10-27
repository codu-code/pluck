import { deletePrefix, keys as blobKeys, putObject, signedUrl } from "@pluck/blob";
import {
  batchTags, batchUpdate, countItems, createHighlight, createTextItem, deleteHighlight, editItem, findByUrl, getContent, getItem, getItemBlobKeys,
  hitRateLimit, listHighlights, listItems, listsForItem, markOpened, misfit, moveToBin, pluckLink, purgeBin, purgeFromBin, resetExtraction, restoreFromBin, setBlobKeys, setItemTags,
  updateHighlight,
} from "@pluck/db";
import {
  extractUrls, isTextKind, normalizeUrl, type BatchBody, type CreateHighlightBody, type CreateItemBody, type CreateItemResult,
  type Highlight, type Item, type ItemPage, type ListItemsQuery, type ListMembership, type PluckResponse, type Status, type UpdateItemBody,
} from "@pluck/shared-schemas";
import { ApiError } from "../errors";
import { keepLater, keepNow } from "./keeping";

type Defer = (task: () => Promise<void>) => void;
const INLINE_TIMEOUT_MS = 5000;
// Every link is a page we fetch for someone, so one account cannot point Pluck at a site thousands of times
// (50 a pluck, 120 plucks a minute, would be 6,000). Import has its own path for whole libraries.
const LINKS_PER_HOUR = 2000;

// Everything POST /items accepts: one URL, many URLs, text with links in it, or a note, todo or thing.
export async function pluckAny(userId: string, body: CreateItemBody, { defer }: { defer?: Defer } = {}): Promise<PluckResponse> {
  const source = body.source ?? "web";
  if (body.text !== undefined && (isTextKind(body.kind) || extractUrls(body.text).length === 0)) {
    const result = await createTextItem(userId, {
      kind: isTextKind(body.kind) ? body.kind : "note", text: body.text, title: body.title, source,
      dueAt: body.dueAt ? new Date(body.dueAt) : null, clientKey: body.clientKey,
    });
    return { results: [result], rejected: [] };
  }
  const inputs = body.url !== undefined ? [body.url] : (body.urls ?? extractUrls(body.text!));
  const budget = await hitRateLimit(`links:${userId}`, LINKS_PER_HOUR, 3600, inputs.length);
  if (!budget.ok) throw new ApiError("rate_limited", "That is a lot of links for one hour. Try again later, or use Import.", 429, { retryAfter: budget.retryAfter });
  if (inputs.length === 1) {
    try {
      return { results: [await pluck(userId, { ...body, url: inputs[0]! }, { defer })], rejected: [] };
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) return { results: [], rejected: [{ input: inputs[0]!, message: e.message }] };
      throw e;
    }
  }
  // Many links: every row lands now, pages are read after the response (or by the retry queue).
  const results: CreateItemResult[] = [];
  const rejected: PluckResponse["rejected"] = [];
  const toExtract: Item[] = [];
  for (const input of inputs) {
    const url = normalizeUrl(input);
    if (!url) {
      rejected.push({ input, message: "That is not a link Pluck can open." });
      continue;
    }
    const { item, created, needsExtraction } = await pluckLink(userId, { url, source });
    results.push({ item, created });
    if (needsExtraction) toExtract.push(item);
  }
  await keepLater(userId, toExtract, { defer });
  return { results, rejected };
}

export async function pluck(userId: string, body: CreateItemBody & { url: string }, { defer }: { defer?: Defer } = {}): Promise<CreateItemResult> {
  const url = normalizeUrl(body.url);
  if (!url) throw new ApiError("bad_request", "That is not a link Pluck can open.", 400);
  const { item, created, needsExtraction } = await pluckLink(userId, { url, title: body.title, note: body.note, source: body.source ?? "web" });
  const kept = needsExtraction || body.html || body.transcript
    ? await keepNow(userId, item, { html: body.html, transcript: body.transcript, timeoutMs: INLINE_TIMEOUT_MS, defer })
    : item;
  // A selection becomes a highlight anchored by its quote; the reader finds it in the kept text.
  const quote = body.selection?.trim();
  if (quote) await addHighlight(userId, { itemId: item.id, quote, selector: { textQuote: { exact: quote, prefix: "", suffix: "" }, textPosition: { start: 0, end: 0 } } });
  return { item: kept, created };
}

// The item a URL is already in, if any (the bin does not count): the extension's badge and "already plucked".
export async function lookup(userId: string, rawUrl: string): Promise<Item | null> {
  const url = normalizeUrl(rawUrl);
  return url ? findByUrl(userId, url) : null;
}

// A cover from the app (the extension's screenshot of the tab) for an item that has none.
export async function setCoverFromApp(userId: string, itemId: string, body: Uint8Array, contentType: string): Promise<Item> {
  const item = await readItem(userId, itemId);
  if (item.hasCover) return item;
  await putObject(blobKeys.cover(userId, itemId), Buffer.from(body), contentType);
  await setBlobKeys(userId, itemId, { coverKey: blobKeys.cover(userId, itemId) });
  return readItem(userId, itemId);
}

export async function retryExtraction(userId: string, itemId: string, { defer }: { defer?: Defer } = {}): Promise<Item> {
  const item = await resetExtraction(userId, itemId);
  if (!item) throw new ApiError("not_found", "No such item.", 404);
  return keepNow(userId, item, { timeoutMs: INLINE_TIMEOUT_MS, defer });
}

export async function readItem(userId: string, itemId: string): Promise<Item> {
  const item = await getItem(userId, itemId);
  if (!item) throw new ApiError("not_found", "No such item.", 404);
  return item;
}

// The kept text of an item: the reader view and what an AI tool reads.
export async function readText(userId: string, itemId: string): Promise<string> {
  return (await getContent(userId, itemId))?.textMarkdown ?? "";
}

import { tagIdsFor, type Actor } from "./tags";

// Edits from the person. Text and the text kinds belong to items with no URL; link kinds to items with one.
export async function updateItem(userId: string, itemId: string, patch: UpdateItemBody, { by = "user" }: { by?: Actor } = {}): Promise<Item> {
  const current = await readItem(userId, itemId);
  const refused = misfit(current.kind, patch);
  if (refused) throw new ApiError("bad_request", refused, 400);
  if (patch.preview !== undefined && current.preview === null) throw new ApiError("bad_request", "Only links open on a Preview.", 400);
  const { tagIds, ...rest } = patch;
  if (tagIds) await setItemTags(userId, itemId, await tagIdsFor(userId, tagIds), by);
  if (!Object.keys(rest).length) return readItem(userId, itemId);
  const updated = await editItem(userId, itemId, {
    ...rest,
    dueAt: rest.dueAt === undefined ? undefined : rest.dueAt === null ? null : new Date(rest.dueAt),
  });
  if (!updated) throw new ApiError("not_found", "No such item.", 404);
  // Show as article on a link kept only for what it said: read it again, keeping the body this time.
  if (patch.preview === "reader" && updated.previewGuess && !["reader", "code", "document"].includes(updated.previewGuess) && updated.url)
    return retryExtraction(userId, itemId);
  return updated;
}

export async function batch(userId: string, body: BatchBody, { by = "user" }: { by?: Actor } = {}): Promise<{ matched: number; updated: number }> {
  const { addTagIds, removeTagIds, ...p } = body.patch;
  const add = addTagIds ? await tagIdsFor(userId, addTagIds) : [];
  const remove = removeTagIds ? await tagIdsFor(userId, removeTagIds) : [];
  // The change goes first: one that does not fit every Item is refused, like an edit of one, before any tag moves.
  const res = Object.keys(p).length
    ? await batchUpdate(userId, body.itemIds, { ...p, dueAt: p.dueAt === undefined ? undefined : p.dueAt === null ? null : new Date(p.dueAt) })
    : { matched: body.itemIds.length, updated: 0, refused: undefined };
  if (res.refused) throw new ApiError("bad_request", res.refused.reason, 400, { itemIds: res.refused.itemIds });
  const tagged = add.length || remove.length ? await batchTags(userId, body.itemIds, add, remove, by) : 0;
  return { matched: res.matched, updated: Math.max(res.updated, tagged) };
}



export const openItem = (userId: string, itemId: string) => markOpened(userId, itemId);
export const count = (userId: string, status: Status) => countItems(userId, status);

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  if (!(await moveToBin(userId, itemId))) throw new ApiError("not_found", "No such item.", 404);
}

export async function restoreItem(userId: string, itemId: string): Promise<Item> {
  const item = await restoreFromBin(userId, itemId);
  if (!item) throw new ApiError("not_found", "Nothing in the bin with that id.", 404);
  return item;
}

// Delete forever: one Item in the person's bin, files included. It cannot be put back.
export async function deleteForever(userId: string, itemId: string): Promise<void> {
  const gone = await purgeFromBin(userId, itemId, async (prefixes) => {
    for (const prefix of prefixes) await deletePrefix(prefix);
  });
  if (!gone) throw new ApiError("not_found", "Nothing in the bin with that id.", 404);
}

// Nightly: items in the bin for 30 days go for good, files included.
export async function purgeBinNow(): Promise<number> {
  const { purged } = await purgeBin(new Date(), async (prefixes) => {
    for (const prefix of prefixes) await deletePrefix(prefix);
  });
  return purged;
}

export const highlightsOf = (userId: string, itemId: string): Promise<Highlight[]> => listHighlights(userId, itemId);

export async function addHighlight(userId: string, body: CreateHighlightBody): Promise<Highlight> {
  const h = await createHighlight(userId, body);
  if (!h) throw new ApiError("not_found", "Highlights are for links you plucked.", 404);
  return h;
}

export async function noteHighlight(userId: string, id: string, note: string | null): Promise<Highlight> {
  const h = await updateHighlight(userId, id, note);
  if (!h) throw new ApiError("not_found", "No such highlight.", 404);
  return h;
}

export async function removeHighlight(userId: string, id: string): Promise<void> {
  if (!(await deleteHighlight(userId, id))) throw new ApiError("not_found", "No such highlight.", 404);
}

// A short-lived URL for an item's cover in the private bucket.
export async function coverLocation(userId: string, itemId: string): Promise<string> {
  const keys = await getItemBlobKeys(userId, itemId);
  if (!keys?.coverKey) throw new ApiError("not_found", "No cover.", 404);
  return signedUrl(keys.coverKey, 600);
}

// A PDF's own file, kept when it was plucked: for Save to Files on the iPhone once the original has gone.
export async function fileLocation(userId: string, itemId: string): Promise<string> {
  const item = await readItem(userId, itemId);
  if (item.kind !== "pdf") throw new ApiError("not_found", "Only a PDF has a file.", 404);
  return signedUrl(blobKeys.file(userId, itemId, "pdf"), 600);
}

export const membershipsOf = (userId: string, itemId: string): Promise<ListMembership[]> => listsForItem(userId, itemId);

export const browse = (userId: string, q: ListItemsQuery): Promise<ItemPage> => listItems(userId, q);
