import { deletePrefix, signedUrl } from "@pluck/blob";
import {
  batchTags, batchUpdate, countItems, createHighlight, createTextItem, deleteHighlight, editItem, getContent, getItem, getItemBlobKeys,
  listHighlights, listItems, listsForItem, markOpened, moveToBin, pluckLink, purgeBin, resetExtraction, restoreFromBin, setItemTags,
  updateHighlight,
} from "@pluck/db";
import {
  extractUrls, isTextKind, LINK_KINDS, normalizeUrl, type BatchBody, type CreateHighlightBody, type CreateItemBody, type CreateItemResult,
  type Highlight, type Item, type ItemPage, type ListItemsQuery, type ListMembership, type PluckResponse, type Status, type UpdateItemBody,
} from "@pluck/shared-schemas";
import { ApiError } from "../errors";
import { extractAttempt } from "../capture";

type Defer = (task: () => Promise<void>) => void;
const INLINE_TIMEOUT_MS = 5000;

// Everything POST /items accepts: one URL, many URLs, text with links in it, or a note, todo or thing.
export async function pluckAny(userId: string, body: CreateItemBody, { defer }: { defer?: Defer } = {}): Promise<PluckResponse> {
  const source = body.source ?? "web";
  if (body.text !== undefined && (isTextKind(body.kind) || extractUrls(body.text).length === 0)) {
    const item = await createTextItem(userId, {
      kind: isTextKind(body.kind) ? body.kind : "note", text: body.text, title: body.title, source,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
    return { results: [{ item, created: true }], rejected: [] };
  }
  const inputs = body.url !== undefined ? [body.url] : (body.urls ?? extractUrls(body.text!));
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
  const work = () => extractMany(userId, toExtract);
  if (defer) defer(work);
  else await work();
  return { results, rejected };
}

async function extractMany(userId: string, items: Item[], concurrency = 6): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await extractAttempt(userId, item, { timeoutMs: 15_000 });
    }),
  );
}

export async function pluck(userId: string, body: CreateItemBody & { url: string }, { defer }: { defer?: Defer } = {}): Promise<CreateItemResult> {
  const url = normalizeUrl(body.url);
  if (!url) throw new ApiError("bad_request", "That is not a link Pluck can open.", 400);
  const { item, created, needsExtraction } = await pluckLink(userId, { url, title: body.title, note: body.note, source: body.source ?? "web" });
  if (!needsExtraction && !body.html) return { item, created };
  return { item: await extractAttempt(userId, item, { html: body.html, timeoutMs: INLINE_TIMEOUT_MS, defer }), created };
}

export async function retryExtraction(userId: string, itemId: string, { defer }: { defer?: Defer } = {}): Promise<Item> {
  const item = await resetExtraction(userId, itemId);
  if (!item) throw new ApiError("not_found", "No such item.", 404);
  return extractAttempt(userId, item, { timeoutMs: INLINE_TIMEOUT_MS, defer });
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
  const hasUrl = current.url !== null;
  if (patch.text !== undefined && hasUrl) throw new ApiError("bad_request", "Only notes, todos and things have text to edit.", 400);
  if (patch.kind && hasUrl !== (LINK_KINDS as readonly string[]).includes(patch.kind))
    throw new ApiError("bad_request", hasUrl ? "A link can be Read, Watch, PDF or Image." : "This can be a Note, Todo or Thing.", 400);
  if (patch.status === "done" && !["todo", "thing"].includes(patch.kind ?? current.kind))
    throw new ApiError("bad_request", "Done is for todos and things.", 400);
  const { tagIds, ...rest } = patch;
  if (tagIds) await setItemTags(userId, itemId, await tagIdsFor(userId, tagIds), by);
  if (!Object.keys(rest).length) return readItem(userId, itemId);
  const updated = await editItem(userId, itemId, {
    ...rest,
    dueAt: rest.dueAt === undefined ? undefined : rest.dueAt === null ? null : new Date(rest.dueAt),
  });
  if (!updated) throw new ApiError("not_found", "No such item.", 404);
  return updated;
}

export async function batch(userId: string, body: BatchBody, { by = "user" }: { by?: Actor } = {}): Promise<{ matched: number; updated: number }> {
  const { addTagIds, removeTagIds, ...p } = body.patch;
  const add = addTagIds ? await tagIdsFor(userId, addTagIds) : [];
  const remove = removeTagIds ? await tagIdsFor(userId, removeTagIds) : [];
  let tagged = 0;
  if (add.length || remove.length) tagged = await batchTags(userId, body.itemIds, add, remove, by);
  if (!Object.keys(p).length) return { matched: body.itemIds.length, updated: tagged };
  const res = await batchUpdate(userId, body.itemIds, { ...p, dueAt: p.dueAt === undefined ? undefined : p.dueAt === null ? null : new Date(p.dueAt) });
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

// Nightly: items in the bin for 30 days go for good, files included.
export async function purgeBinNow(): Promise<number> {
  const { purged, blobPrefixes } = await purgeBin();
  for (const prefix of blobPrefixes) await deletePrefix(prefix);
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

export const membershipsOf = (userId: string, itemId: string): Promise<ListMembership[]> => listsForItem(userId, itemId);

export const browse = (userId: string, q: ListItemsQuery): Promise<ItemPage> => listItems(userId, q);
