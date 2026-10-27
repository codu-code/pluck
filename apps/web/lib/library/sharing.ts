import { signedUrl } from "@pluck/blob";
import {
  createList, createReport, createTextItem, getListMeta, getMe, hitRateLimit, leaveSharedList, listOwnedBy, listsSharedWith, pluckLink, publicCoverKey,
  publicList, publicListById, recordView, setHandle, setName, setVisibility, sharedCoverKey, sharedList, shareList, sharesOf, unshareList,
  updateSettings, MAX_PEOPLE,
} from "@pluck/db";
import { normalizeUrl, type Item, type List, type ListShare, type Me, type PublicList, type Settings, type SharedListSummary } from "@pluck/shared-schemas";
import { sendEmail } from "../email";
import { sharedListEmail } from "../emails";
import { ApiError } from "../errors";
import { log } from "../log";
import { keepLater } from "./keeping";
import { ORIGIN } from "../origin";

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
  // A public list, or one shared with them.
  const page = (await publicListById(listId)) ?? (await sharedList(listId, (await me(userId)).email));
  if (!page) throw new ApiError("not_found", "That list is not public or shared with you.", 404);
  const entries: { itemId: string; note: string | null }[] = [];
  const toRead: Item[] = [];
  for (const e of page.entries) {
    const url = e.url && normalizeUrl(e.url);
    if (url) {
      const { item, needsExtraction } = await pluckLink(userId, { url, title: e.title, source: "copied" });
      if (needsExtraction) toRead.push(item);
      entries.push({ itemId: item.id, note: e.note });
    } else {
      const { item: note } = await createTextItem(userId, { kind: "note", text: [e.title, e.excerpt].filter(Boolean).join("\n"), source: "copied" });
      entries.push({ itemId: note.id, note: e.note });
    }
  }
  const list = await createList(userId, { name: page.list.name, purpose: page.list.purpose, createdBy: "user", items: entries });
  await keepLater(userId, toRead, { defer });
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

// ---- Sharing a List with people, See only ----------------------------------------------------------------

// Each new person is an email we send to an address someone typed: a few a day per account.
const PEOPLE_PER_DAY = 10;

const SHARE_ERRORS = {
  not_found: new ApiError("not_found", "No such list.", 404),
  self: new ApiError("bad_request", "That is you. The List is already yours.", 400),
  full: new ApiError("conflict", `A List can be shared with ${MAX_PEOPLE} people.`, 409),
  closed: new ApiError("forbidden", "Sharing is closed for this account.", 403),
};

export async function shareWith(userId: string, listId: string, email: string): Promise<ListShare> {
  const budget = await hitRateLimit(`share:${userId}`, PEOPLE_PER_DAY, 86_400);
  if (!budget.ok) throw new ApiError("rate_limited", "That is a lot of people for one day. Try again tomorrow.", 429, { retryAfter: budget.retryAfter });
  const res = await shareList(userId, listId, email);
  if (!res.ok) throw SHARE_ERRORS[res.reason];
  if (res.created) {
    const [owner, list] = await Promise.all([me(userId), getListMeta(userId, listId)]);
    await sendEmail(sharedListEmail(res.share.email, { name: owner.name || null, handle: owner.handle ?? "" }, list?.name ?? null, `${ORIGIN}/shared/${listId}`, res.recipientLocale ?? owner.settings.locale ?? "en"));
  }
  return res.share;
}

export async function peopleOf(userId: string, listId: string): Promise<ListShare[]> {
  const people = await sharesOf(userId, listId);
  if (!people) throw SHARE_ERRORS.not_found;
  return people;
}

export async function stopSharing(userId: string, listId: string, shareId: string): Promise<void> {
  if (!(await unshareList(userId, listId, shareId))) throw new ApiError("not_found", "Not shared with that person.", 404);
}

// The person it is shared with is whoever signs in with that email (the link proves the address).
export async function sharedWithMe(userId: string): Promise<SharedListSummary[]> {
  return listsSharedWith((await me(userId)).email);
}

export async function readShared(userId: string, listId: string): Promise<PublicList> {
  const page = await sharedList(listId, (await me(userId)).email);
  if (!page) throw new ApiError("not_found", "That List is not shared with you, or it has gone.", 404);
  return page;
}

export async function leaveShared(userId: string, listId: string): Promise<void> {
  if (!(await leaveSharedList(listId, (await me(userId)).email))) throw new ApiError("not_found", "That List is not shared with you.", 404);
}

export async function sharedCoverLocation(userId: string, listId: string, itemId: string): Promise<string> {
  const key = await sharedCoverKey(listId, itemId, (await me(userId)).email);
  if (!key) throw new ApiError("not_found", "No cover.", 404);
  return signedUrl(key, 600);
}
