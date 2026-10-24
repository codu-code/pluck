import type { Filter, ObjectId } from "mongodb";
import { DEFAULT_SETTINGS, items, meta, oid, users, type ItemDoc, type UserSettings } from "./collections.ts";

// Expiry and "Archive it all": untouched Inbox (and Later) items move to the Archive. Nothing is deleted,
// and items in any list are left alone. The nightly job marks them "expired", the button marks them "bulk".

const DAY_MS = 86_400_000;
const scopeStatuses = (scope: UserSettings["expiryScope"]) => (scope === "inbox" ? ["inbox"] : ["inbox", "later"]);

function staleFilter(userId: ObjectId, days: number, scope: UserSettings["expiryScope"], now: Date): Filter<ItemDoc> {
  return {
    userId,
    deletedAt: null,
    status: { $in: scopeStatuses(scope) as ItemDoc["status"][] },
    lastTouchedAt: { $lt: new Date(now.getTime() - days * DAY_MS) },
    inList: { $ne: true },
  };
}

async function archive(filter: Filter<ItemDoc>, reason: "expired" | "bulk", now: Date): Promise<number> {
  const res = await (await items()).updateMany(filter, { $set: { status: "archived", archivedReason: reason, statusChangedAt: now, updatedAt: now } });
  return res.modifiedCount;
}

export async function expireItems(userId: string, days: number, scope: UserSettings["expiryScope"], now = new Date()): Promise<number> {
  return archive(staleFilter(oid(userId), days, scope, now), "expired", now);
}

// The "Archive it all. No, really." button. A dry run returns the count for the confirm step.
export async function archiveStale(
  userId: string,
  { olderThanDays, scope, dryRun }: { olderThanDays: number; scope: UserSettings["expiryScope"]; dryRun: boolean },
  now = new Date(),
): Promise<number> {
  const filter = staleFilter(oid(userId), olderThanDays, scope, now);
  return dryRun ? (await items()).countDocuments(filter) : archive(filter, "bulk", now);
}

// Items that will expire within `withinDays` (the digest's warning and Later's subtitle).
export async function countExpiringSoon(userId: string, settings: UserSettings, statuses: ItemDoc["status"][], withinDays = 7, now = new Date()): Promise<number> {
  if (!settings.expiryDays) return 0;
  const inScope = statuses.filter((s) => scopeStatuses(settings.expiryScope).includes(s));
  if (!inScope.length) return 0;
  const from = new Date(now.getTime() - settings.expiryDays * DAY_MS);
  return (await items()).countDocuments({
    userId: oid(userId), deletedAt: null, status: { $in: inScope }, inList: { $ne: true },
    lastTouchedAt: { $gte: from, $lt: new Date(from.getTime() + withinDays * DAY_MS) },
  });
}

// The person's local date and hour in their timezone (falls back to UTC for an unknown zone).
export function localNow(now: Date, timezone: string): { date: string; hour: number; weekday: number } {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

// The nightly run: for each person with expiry on, once per local day, at or after 02:00 their time.
// The claim is an atomic update on the user, so two workers never both run it.
export async function runDueExpiry(now = new Date()): Promise<{ users: number; archived: number; perUser: { userId: string; archived: number }[] }> {
  const col = await users();
  // Missing settings mean the defaults (expiry and the email on), and `$ne: null` would skip a missing field.
  // shortcut: reads every person each minute; fine to tens of thousands, then keep a next-due time per person.
  const candidates = await col.find({ "settings.expiryDays": { $not: { $type: "null" } } }, { projection: { settings: 1, expiryRanOn: 1 } }).toArray();
  const perUser: { userId: string; archived: number }[] = [];
  for (const u of candidates) {
    const s = { ...DEFAULT_SETTINGS, ...u.settings };
    if (!s.expiryDays) continue;
    const local = localNow(now, s.timezone);
    if (local.hour < 2 || u.expiryRanOn === local.date) continue;
    const claimed = await col.updateOne({ _id: u._id, expiryRanOn: { $ne: local.date } }, { $set: { expiryRanOn: local.date } });
    if (!claimed.modifiedCount) continue;
    perUser.push({ userId: u._id.toHexString(), archived: await expireItems(u._id.toHexString(), s.expiryDays, s.expiryScope, now) });
  }
  return { users: perUser.length, archived: perUser.reduce((n, p) => n + p.archived, 0), perUser };
}

// Once per key, across every instance (bin purge once a UTC day, and the like). Keys expire after a week.
export async function claimOnce(key: string): Promise<boolean> {
  try {
    await (await meta()).insertOne({ _id: key, at: new Date() });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}
