import type { ListShare } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { lists, listShares, oid, users, type ListShareDoc } from "./collections.ts";
import { getMe } from "./users.ts";

// Sharing a list with people, See only. The owner adds and removes them by email; they read it through public.ts.

export const MAX_PEOPLE = 20;

const toShare = (d: ListShareDoc): ListShare => ({ id: d._id.toHexString(), email: d.email, createdAt: d.createdAt.toISOString() });

export type ShareResult = { ok: true; share: ListShare; created: boolean } | { ok: false; reason: "not_found" | "self" | "full" | "closed" };

export async function shareList(userId: string, listId: string, email: string, now = new Date()): Promise<ShareResult> {
  const uid = oid(userId);
  const list = await (await lists()).findOne({ _id: oid(listId), userId: uid }, { projection: { killed: 1 } });
  if (!list) return { ok: false, reason: "not_found" };
  const owner = await (await users()).findOne({ _id: uid }, { projection: { email: 1, publicKilled: 1 } });
  if (!owner || owner.publicKilled || list.killed) return { ok: false, reason: "closed" };
  const to = email.trim().toLowerCase();
  if (owner.email.toLowerCase() === to) return { ok: false, reason: "self" };
  const col = await listShares();
  const existing = await col.findOne({ listId: list._id, email: to });
  if (existing) return { ok: true, share: toShare(existing), created: false };
  if ((await col.countDocuments({ listId: list._id })) >= MAX_PEOPLE) return { ok: false, reason: "full" };
  const doc: ListShareDoc = { _id: new ObjectId(), listId: list._id, ownerId: uid, email: to, createdAt: now };
  try {
    await col.insertOne(doc);
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e; // the same person twice at once: one row
    return { ok: true, share: toShare((await col.findOne({ listId: list._id, email: to }))!), created: false };
  }
  await getMe(userId); // the shared view shows the owner's handle; this makes sure there is one
  return { ok: true, share: toShare(doc), created: true };
}

// The people a list is shared with, for its owner. Null when it is not their list.
export async function sharesOf(userId: string, listId: string): Promise<ListShare[] | null> {
  const list = await (await lists()).findOne({ _id: oid(listId), userId: oid(userId) }, { projection: { _id: 1 } });
  if (!list) return null;
  return (await (await listShares()).find({ listId: list._id }).sort({ createdAt: 1 }).toArray()).map(toShare);
}

export async function unshareList(userId: string, listId: string, shareId: string): Promise<boolean> {
  const res = await (await listShares()).deleteOne({ _id: oid(shareId), listId: oid(listId), ownerId: oid(userId) });
  return res.deletedCount === 1;
}

// The person it was shared with takes it off their Lists.
export async function leaveSharedList(listId: string, viewerEmail: string): Promise<boolean> {
  const res = await (await listShares()).deleteOne({ listId: oid(listId), email: viewerEmail.toLowerCase() });
  return res.deletedCount === 1;
}
