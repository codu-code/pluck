import type { AdminReport } from "@pluck/shared-schemas";
import { lists, oid, reports, users } from "./collections.ts";

// The admin route behind the allowlist: reports in, and the two kill switches.

export async function openReports(): Promise<AdminReport[]> {
  const docs = await (await reports()).find({ state: "open" }).sort({ createdAt: -1 }).limit(200).toArray();
  const ls = await (await lists()).find({ _id: { $in: docs.map((d) => d.listId) } }, { projection: { name: 1, slug: 1, userId: 1, killed: 1 } }).toArray();
  const owners = await (await users()).find({ _id: { $in: ls.map((l) => l.userId) } }, { projection: { handle: 1, email: 1, publicKilled: 1 } }).toArray();
  return docs.map((d) => {
    const l = ls.find((x) => x._id.equals(d.listId));
    const o = l && owners.find((x) => x._id.equals(l.userId));
    return {
      id: d._id.toHexString(), reason: d.reason, details: d.details, createdAt: d.createdAt.toISOString(),
      list: l ? { id: l._id.toHexString(), name: l.name, slug: l.slug, killed: Boolean(l.killed) } : null,
      owner: o ? { id: o._id.toHexString(), handle: o.handle ?? null, email: o.email, closed: Boolean(o.publicKilled) } : null,
    };
  });
}

export async function resolveReport(id: string): Promise<void> {
  await (await reports()).updateOne({ _id: oid(id) }, { $set: { state: "resolved" } });
}

// Takes one list off the public web at once. The owner keeps it privately.
export async function killList(listId: string): Promise<void> {
  await (await lists()).updateOne({ _id: oid(listId) }, { $set: { killed: true, visibility: "private" } });
}

// Closes every public page of one person and stops them publishing again.
export async function killUser(userId: string): Promise<void> {
  const uid = oid(userId);
  await (await users()).updateOne({ _id: uid }, { $set: { publicKilled: true } });
  await (await lists()).updateMany({ userId: uid, visibility: "public" }, { $set: { visibility: "private" } });
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const allow = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
