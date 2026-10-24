import type { Me } from "@pluck/shared-schemas";
import { DEFAULT_SETTINGS, oid, users, type UserDoc, type UserSettings } from "./collections.ts";

const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;
const RESERVED = new Set(
  "admin api app settings inbox later lists archive search signin signup login logout p copy help support pluck getpluck www mail root about terms privacy open-source connect offline items u mcp oauth".split(" "),
);
const MONTH_MS = 30 * 86_400_000;

const toMe = (d: UserDoc): Me => ({
  id: d._id.toHexString(), email: d.email, name: d.name ?? "", handle: d.handle ?? null,
  handleChangeableAt: d.handle && d.handleChangedAt ? new Date(d.handleChangedAt.getTime() + MONTH_MS).toISOString() : null,
  createdAt: d.createdAt.toISOString(),
  settings: { ...DEFAULT_SETTINGS, ...d.settings },
  lastMcpCallAt: d.lastMcpCallAt?.toISOString() ?? null,
});

// Settings shows "Connected · last call"; one write a minute at most, however busy the AI tool is.
export async function markMcpCall(userId: string, now = new Date()): Promise<void> {
  await (await users()).updateOne(
    { _id: oid(userId), $or: [{ lastMcpCallAt: { $exists: false } }, { lastMcpCallAt: { $lt: new Date(now.getTime() - 60_000) } }] },
    { $set: { lastMcpCallAt: now } },
  );
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<Me | null> {
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined).map(([k, v]) => [`settings.${k}`, v]));
  const doc = await (await users()).findOneAndUpdate({ _id: oid(userId) }, { $set: set }, { returnDocument: "after" });
  return doc && toMe(doc);
}

export async function getMe(userId: string): Promise<Me | null> {
  const doc = await (await users()).findOne({ _id: oid(userId) });
  return doc && toMe(doc);
}

export async function setName(userId: string, name: string): Promise<Me | null> {
  const doc = await (await users()).findOneAndUpdate({ _id: oid(userId) }, { $set: { name: name.trim().slice(0, 80) } }, { returnDocument: "after" });
  return doc && toMe(doc);
}

export type HandleResult = { ok: true; me: Me } | { ok: false; reason: "invalid" | "reserved" | "taken" | "too_soon" };

// 3 to 24 characters, lowercase letters, digits and hyphens, unique, changeable once a month.
export async function setHandle(userId: string, raw: string, now = new Date()): Promise<HandleResult> {
  const handle = raw.trim().toLowerCase().replace(/^@/, "");
  if (!HANDLE.test(handle)) return { ok: false, reason: "invalid" };
  if (RESERVED.has(handle)) return { ok: false, reason: "reserved" };
  const col = await users();
  const me = await col.findOne({ _id: oid(userId) });
  if (!me) return { ok: false, reason: "invalid" };
  if (me.handle === handle) return { ok: true, me: toMe(me) };
  if (me.handle && me.handleChangedAt && now.getTime() - me.handleChangedAt.getTime() < MONTH_MS) return { ok: false, reason: "too_soon" };
  try {
    const doc = await col.findOneAndUpdate({ _id: me._id }, { $set: { handle, handleChangedAt: now } }, { returnDocument: "after" });
    return { ok: true, me: toMe(doc!) };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { ok: false, reason: "taken" };
    throw e;
  }
}
