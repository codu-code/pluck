import { freshAnswer, funHandle, HANDLE, type HeardFrom, type Me } from "@pluck/shared-schemas";
import { DEFAULT_SETTINGS, oid, users, type SignUpVia, type UserDoc, type UserSettings } from "./collections.ts";

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
  heardFrom: d.heardFrom ?? null,
});

// "How did you find Pluck?": the first answer stays.
export async function setHeardFrom(userId: string, heardFrom: HeardFrom): Promise<boolean> {
  return (await (await users()).updateOne({ _id: oid(userId), heardFrom: { $exists: false } }, { $set: { heardFrom } })).modifiedCount > 0;
}

// Settings shows "Connected · last call"; one write a minute at most, however busy the AI tool is.
export async function markMcpCall(userId: string, now = new Date()): Promise<void> {
  await (await users()).updateOne(
    { _id: oid(userId), $or: [{ lastMcpCallAt: { $exists: false } }, { lastMcpCallAt: { $lt: new Date(now.getTime() - 60_000) } }] },
    { $set: { lastMcpCallAt: now } },
  );
}

// Where the account was made. Written once, by the sign-up hook.
export async function setVia(userId: string, via: SignUpVia): Promise<void> {
  await (await users()).updateOne({ _id: oid(userId), via: { $exists: false } }, { $set: { via } });
}

// What usage analytics may know of an account: its answer to the cookie question, and (for signed_up) when and how it began.
export async function analyticsOf(userId: string): Promise<{ consent: "yes" | "no" | null; createdAt: Date; via: SignUpVia | null } | null> {
  const d = await (await users()).findOne({ _id: oid(userId) }, { projection: { "settings.analytics": 1, "settings.analyticsAt": 1, createdAt: 1, via: 1 } });
  const answer = freshAnswer({ analytics: d?.settings?.analytics ?? null, analyticsAt: d?.settings?.analyticsAt ?? null });
  return d && { consent: answer?.answer ?? null, createdAt: d.createdAt, via: d.via ?? null };
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<Me | null> {
  const { analytics, analyticsAt, ...rest } = patch;
  const col = await users();
  // The cookie answer replaces only an older one, so a device that was offline cannot undo a newer answer from another.
  // Never dated ahead of now, or no later answer could replace it.
  if (analytics !== undefined) {
    const at = Math.min(analyticsAt ?? Date.now(), Date.now());
    await col.updateOne(
      { _id: oid(userId), $or: [{ "settings.analyticsAt": { $in: [null] } }, { "settings.analyticsAt": { $lt: at } }] },
      { $set: { "settings.analytics": analytics, "settings.analyticsAt": at } },
    );
  }
  const set = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => [`settings.${k}`, v]));
  const doc = Object.keys(set).length
    ? await col.findOneAndUpdate({ _id: oid(userId) }, { $set: set }, { returnDocument: "after" })
    : await col.findOne({ _id: oid(userId) });
  return doc && toMe(doc);
}

export async function getMe(userId: string): Promise<Me | null> {
  const doc = await (await users()).findOne({ _id: oid(userId) });
  if (!doc) return null;
  if (doc.handle) return toMe(doc);
  // No handle yet (every account until its first read): give one. A race with another read is fine; reread.
  return toMe((await giveHandle(userId)) ?? (await (await users()).findOne({ _id: doc._id }))!);
}

// A made-up handle (funHandle) for an account with none. It has no handleChangedAt: the once-a-month rule is for
// handles people save, so their first change is free. Null when another read gave one meanwhile.
async function giveHandle(userId: string): Promise<UserDoc | null> {
  const col = await users();
  for (let i = 0; i < 8; i++) {
    const handle = funHandle();
    if (RESERVED.has(handle)) continue;
    try {
      const doc = await col.findOneAndUpdate(
        { _id: oid(userId), handle: { $in: [null] } }, // $in null also matches a missing field
        { $set: { handle, handleChangedAt: null } },
        { returnDocument: "after" },
      );
      return doc;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // taken: roll again
    }
  }
  throw new Error("No free made-up handle after 8 tries.");
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
