import { createHash } from "node:crypto";
import { defaultPreview, type PublicList, type SharedListSummary } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { items, listRows, lists, listShares, oid, reports, users, type ListDoc, type UserDoc } from "./collections.ts";

// The only code that serves list data to anyone but its owner: public pages, and Lists shared with people (See only).
// It reads lists, listItems and a narrow slice of items, and never touches contents, tags, ticks (marks) or status.
// Its field lists are pinned by public.test.ts.

export const PUBLIC_ITEM_FIELDS = { title: 1, siteName: 1, excerpt: 1, coverKey: 1, url: 1, kind: 1, wordCount: 1, previewGuess: 1, previewOverride: 1, facts: 1 } as const;
const WEEK_MS = 7 * 86_400_000;

async function findPublic(handle: string, slug: string) {
  const owner = await (await users()).findOne({ handle: handle.toLowerCase(), publicKilled: { $ne: true } }, { projection: { _id: 1, name: 1, handle: 1, createdAt: 1 } });
  if (!owner) return null;
  const list = await (await lists()).findOne({ userId: owner._id, slug, visibility: "public", killed: { $ne: true } });
  return list ? { owner, list } : null;
}

export async function publicList(handle: string, slug: string, now = new Date()): Promise<PublicList | null> {
  const found = await findPublic(handle, slug);
  return found && seeOnly(found.list, found.owner, now);
}

// What anyone but the owner sees of a list: its name, purpose and each item's public fields with the list's note.
async function seeOnly(list: ListDoc, owner: Pick<UserDoc, "_id" | "name" | "handle" | "createdAt">, now: Date): Promise<PublicList> {
  const rows = await (await listRows()).find({ listId: list._id }, { projection: { itemId: 1, note: 1, position: 1 } }).sort({ position: 1 }).toArray();
  const docs = await (await items())
    .find({ _id: { $in: rows.map((r) => r.itemId) }, userId: owner._id, deletedAt: null }, { projection: PUBLIC_ITEM_FIELDS })
    .toArray();
  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  const entries = rows.flatMap((r) => {
    const d = byId.get(r.itemId.toHexString());
    return d
      ? [{
        id: d._id.toHexString(), kind: d.kind, title: d.title, siteName: d.siteName ?? null, excerpt: d.excerpt ?? null, url: d.url ?? null,
        wordCount: d.wordCount ?? null, hasCover: Boolean(d.coverKey), note: r.note ?? null,
        preview: d.previewOverride ?? d.previewGuess ?? defaultPreview(d.kind), facts: d.facts ?? {},
      }]
      : [];
  });
  return {
    list: {
      // updatedAt, not lastActivityAt: marking is the owner's alone and must not show here.
      id: list._id.toHexString(), name: list.name, purpose: list.purpose, updatedAt: list.updatedAt.toISOString(), itemCount: entries.length,
      // New lists and new accounts stay out of search engines for a week (link farms).
      noindex: now.getTime() - list.createdAt.getTime() < WEEK_MS || now.getTime() - owner.createdAt.getTime() < WEEK_MS,
    },
    author: { name: owner.name || null, handle: owner.handle! },
    entries,
  };
}

// A list shared with this email (See only), in the public view's shape. Null when it is not shared with them.
export async function sharedList(listId: string, viewerEmail: string, now = new Date()): Promise<PublicList | null> {
  const found = await findShared(listId, viewerEmail);
  return found && seeOnly(found.list, found.owner, now);
}

async function findShared(listId: string, viewerEmail: string) {
  const share = await (await listShares()).findOne({ listId: oid(listId), email: viewerEmail.toLowerCase() }, { projection: { _id: 1 } });
  if (!share) return null;
  const list = await (await lists()).findOne({ _id: oid(listId), killed: { $ne: true } });
  if (!list) return null;
  const owner = await (await users()).findOne({ _id: list.userId, publicKilled: { $ne: true } }, { projection: { _id: 1, name: 1, handle: 1, createdAt: 1 } });
  return owner ? { list, owner } : null;
}

// The lists shared with this email, newest share first, for their Lists page.
export async function listsSharedWith(viewerEmail: string): Promise<SharedListSummary[]> {
  const shares = await (await listShares()).find({ email: viewerEmail.toLowerCase() }).sort({ createdAt: -1 }).limit(200).toArray();
  const found = await (await lists()).find({ _id: { $in: shares.map((x) => x.listId) }, killed: { $ne: true } }, { projection: { name: 1, purpose: 1, itemCount: 1, userId: 1 } }).toArray();
  const owners = await (await users()).find({ _id: { $in: found.map((l) => l.userId) }, publicKilled: { $ne: true } }, { projection: { name: 1, handle: 1 } }).toArray();
  const listById = new Map(found.map((l) => [l._id.toHexString(), l]));
  const ownerById = new Map(owners.map((o) => [o._id.toHexString(), o]));
  return shares.flatMap((x) => {
    const l = listById.get(x.listId.toHexString());
    const o = l && ownerById.get(l.userId.toHexString());
    return l && o ? [{ id: l._id.toHexString(), name: l.name, purpose: l.purpose, itemCount: l.itemCount, owner: { name: o.name || null, handle: o.handle ?? "" }, sharedAt: x.createdAt.toISOString() }] : [];
  });
}

// The cover key for one item on a list shared with this email.
export async function sharedCoverKey(listId: string, itemId: string, viewerEmail: string): Promise<string | null> {
  const found = await findShared(listId, viewerEmail);
  if (!found || !(await (await listRows()).findOne({ listId: found.list._id, itemId: oid(itemId) }, { projection: { _id: 1 } }))) return null;
  const item = await (await items()).findOne({ _id: oid(itemId), userId: found.list.userId, deletedAt: null }, { projection: { coverKey: 1 } });
  return item?.coverKey ?? null;
}

// The cover key for one item, only when that item is on a public, live list.
export async function publicCoverKey(listId: string, itemId: string): Promise<string | null> {
  const list = await (await lists()).findOne({ _id: oid(listId), visibility: "public", killed: { $ne: true } }, { projection: { userId: 1 } });
  if (!list) return null;
  const owner = await (await users()).findOne({ _id: list.userId, publicKilled: { $ne: true } }, { projection: { _id: 1 } });
  if (!owner || !(await (await listRows()).findOne({ listId: list._id, itemId: oid(itemId) }, { projection: { _id: 1 } }))) return null;
  const item = await (await items()).findOne({ _id: oid(itemId), userId: list.userId, deletedAt: null }, { projection: { coverKey: 1 } });
  return item?.coverKey ?? null;
}

export async function recordView(listId: string): Promise<void> {
  await (await lists()).updateOne({ _id: oid(listId), visibility: "public" }, { $inc: { views: 1 } });
}

// Reports from the public page. The address is kept only as a salted hash, enough to spot one source.
export async function createReport(listId: string, ip: string, reason: string, details: string | null): Promise<boolean> {
  const list = await (await lists()).findOne({ _id: oid(listId), visibility: "public" }, { projection: { _id: 1 } });
  if (!list) return false;
  const salt = process.env.BETTER_AUTH_SECRET ?? "pluck";
  await (await reports()).insertOne({
    _id: new ObjectId(), listId: list._id, reporterIp: createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32),
    reason, details: details?.trim().slice(0, 2000) || null, createdAt: new Date(), state: "open",
  });
  return true;
}

// The same public view, found by list id (for "Pluck this list").
export async function publicListById(listId: string): Promise<PublicList | null> {
  const list = await (await lists()).findOne({ _id: oid(listId), visibility: "public", killed: { $ne: true } }, { projection: { userId: 1, slug: 1 } });
  if (!list) return null;
  const owner = await (await users()).findOne({ _id: list.userId }, { projection: { handle: 1 } });
  return owner?.handle ? publicList(owner.handle, list.slug) : null;
}
