import { signedUrl } from "@pluck/blob";
import { getContent, getItem, getItemBlobKeys, listItems, pluckLink, resetExtraction } from "@pluck/db";
import { normalizeUrl, type CreateItemBody, type CreateItemResult, type Item, type ItemPage, type ListItemsQuery } from "@pluck/shared-schemas";
import { ApiError } from "./errors";
import { extractAttempt } from "./capture";

// The library: what a signed-in person can do with their items. REST routes and MCP tools both call this.

type Defer = (task: () => Promise<void>) => void;
const INLINE_TIMEOUT_MS = 5000;

export async function pluck(userId: string, body: CreateItemBody, { defer }: { defer?: Defer } = {}): Promise<CreateItemResult> {
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

// A short-lived URL for an item's cover in the private bucket.
export async function coverLocation(userId: string, itemId: string): Promise<string> {
  const keys = await getItemBlobKeys(userId, itemId);
  if (!keys?.coverKey) throw new ApiError("not_found", "No cover.", 404);
  return signedUrl(keys.coverKey, 600);
}

export const browse = (userId: string, q: ListItemsQuery): Promise<ItemPage> => listItems(userId, q);
