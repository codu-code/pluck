import { signedUrl } from "@pluck/blob";
import {
  createList, createReport, createTextItem, getMe, hitRateLimit, listOwnedBy, pluckLink, publicCoverKey, publicList, publicListById, recordView,
  rollHandle, setHandle, setName, setVisibility, updateSettings,
} from "@pluck/db";
import { normalizeUrl, type Item, type List, type Me, type PublicList, type Settings } from "@pluck/shared-schemas";
import { sendEmail } from "../email";
import { ApiError } from "../errors";
import { log } from "../log";
import { queueExtraction } from "./items";

type Defer = (task: () => Promise<void>) => void;

export async function me(userId: string): Promise<Me> {
  const m = await getMe(userId);
  if (!m) throw new ApiError("not_found", "No such account.", 404);
  return m;
}

const HANDLE_ERRORS = {
  invalid: new ApiError("bad_request", "A handle is 3 to 24 lowercase letters, numbers or hyphens.", 400),
  reserved: new ApiError("conflict", "That handle is reserved. Try another.", 409),
  taken: new ApiError("conflict", "That handle is taken. Try another.", 409),
  too_soon: new ApiError("conflict", "You can change your handle once a month.", 409),
};

export async function updateMe(userId: string, patch: { name?: string; handle?: string; settings?: Partial<Settings> }): Promise<Me> {
  if (patch.name !== undefined) await setName(userId, patch.name);
  if (patch.settings) await updateSettings(userId, patch.settings);
  if (patch.handle !== undefined) {
    const res = await setHandle(userId, patch.handle);
    if (!res.ok) throw HANDLE_ERRORS[res.reason];
  }
  return me(userId);
}

// "Make one up": a fresh made-up handle (plucky-puffin-42).
export async function makeUpHandle(userId: string): Promise<Me> {
  const res = await rollHandle(userId);
  if (!res.ok) throw HANDLE_ERRORS[res.reason];
  return res.me;
}

export async function setListVisibility(userId: string, listId: string, visibility: "private" | "public"): Promise<List> {
  const res = await setVisibility(userId, listId, visibility);
  if (res.ok) return res.list;
  if (res.reason === "handle_required") throw new ApiError("handle_required", "Pick a handle first. It goes in the link.", 409);
  if (res.reason === "closed") throw new ApiError("forbidden", "Public lists are closed for this account.", 403);
  throw new ApiError("not_found", "No such list.", 404);
}

// Route params can arrive still percent-encoded (the /@handle/slug rewrite passes them on as they came), and a slug
// can hold any letter: "café-東京-reading". A malformed escape is left as it is, and then simply finds nothing.
const decoded = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// The public page's data. Views count on the server, never for the owner.
export async function publicPage(
  handle: string,
  slug: string,
  { viewerId, count = true }: { viewerId?: string | null; count?: boolean } = {},
): Promise<PublicList | null> {
  const page = await publicList(decoded(handle), decoded(slug));
  if (page && count && !(viewerId && (await listOwnedBy(page.list.id, viewerId)))) await recordView(page.list.id);
  return page;
}

// For the "Pluck this list" confirm page.
export const publicListFor = (listId: string): Promise<PublicList | null> => publicListById(listId);

export async function publicCover(listId: string, itemId: string): Promise<string> {
  const key = await publicCoverKey(listId, itemId);
  if (!key) throw new ApiError("not_found", "No cover.", 404);
  return signedUrl(key, 600);
}

// "Pluck this list": the items into your library (as re-plucks where you have them) and a private copy of the list.
export async function copyList(userId: string, listId: string, { defer }: { defer?: Defer } = {}): Promise<List> {
  const limit = await hitRateLimit(`copy:${userId}`, 20, 86_400);
  if (!limit.ok) throw new ApiError("rate_limited", "That is 20 lists copied today. Try again tomorrow.", 429, { retryAfter: limit.retryAfter });
  const page = await publicListById(listId);
  if (!page) throw new ApiError("not_found", "That list is not public.", 404);
  const entries: { itemId: string; note: string | null }[] = [];
  const toRead: Item[] = [];
  for (const e of page.entries) {
    const url = e.url && normalizeUrl(e.url);
    if (url) {
      const { item, needsExtraction } = await pluckLink(userId, { url, title: e.title, source: "copied" });
      if (needsExtraction) toRead.push(item);
      entries.push({ itemId: item.id, note: e.note });
    } else {
      const note = await createTextItem(userId, { kind: "note", text: [e.title, e.excerpt].filter(Boolean).join("\n"), source: "copied" });
      entries.push({ itemId: note.id, note: e.note });
    }
  }
  const list = await createList(userId, { name: page.list.name, purpose: page.list.purpose, createdBy: "user", items: entries });
  await queueExtraction(userId, toRead, { defer });
  return list;
}

// A report from the public page: stored for the admin route and emailed to the abuse address.
export async function report(listId: string, ip: string, reason: string, details?: string): Promise<void> {
  if (!(await createReport(listId, ip, reason, details ?? null))) throw new ApiError("not_found", "That list is not public.", 404);
  const to = process.env.ABUSE_EMAIL;
  if (!to) return;
  await sendEmail({
    to,
    subject: `Report: ${reason} on list ${listId}`,
    text: `A public list was reported.\n\nList: ${listId}\nReason: ${reason}\nDetails: ${details ?? "(none)"}\n\nReview it in /admin.\n`,
  }).catch((e) => log("error", "report email failed", { error: e }));
}
