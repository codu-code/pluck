import { TASK_KINDS, type Digest } from "@pluck/shared-schemas";
import { DEFAULT_SETTINGS, items, lists, oid, users, type UserSettings } from "./collections.ts";
import { localNow } from "./expiry.ts";

// The Monday digest, plain rules, no model: what expires within a week (not in a list), what is due this
// week, the five oldest in the Inbox, and lists with no activity in 30 days. The same data is get_digest.

const DAY = 86_400_000;

export async function digestFor(userId: string, settings: UserSettings, now = new Date(), limit = 5): Promise<Digest> {
  const uid = oid(userId);
  const col = await items();
  const base = { userId: uid, deletedAt: null };
  const scope = settings.expiryScope === "inbox" ? ["inbox"] : ["inbox", "later"];
  const days = settings.expiryDays;
  const lean = { projection: { title: 1, siteName: 1, url: 1, kind: 1, lastTouchedAt: 1, dueAt: 1, createdAt: 1 } };

  const [expiring, due, oldest, quiet] = await Promise.all([
    days
      ? col
          .find(
            {
              ...base, status: { $in: scope as never[] }, inList: { $ne: true },
              lastTouchedAt: { $gte: new Date(now.getTime() - days * DAY), $lt: new Date(now.getTime() - (days - 7) * DAY) },
            },
            lean,
          )
          .sort({ lastTouchedAt: 1 })
          .limit(limit)
          .toArray()
      : [],
    col
      .find({ ...base, kind: { $in: [...TASK_KINDS] }, status: { $ne: "done" }, dueAt: { $gte: new Date(now.getTime() - DAY), $lt: new Date(now.getTime() + 7 * DAY) } }, lean)
      .sort({ dueAt: 1 })
      .limit(limit)
      .toArray(),
    col.find({ ...base, status: "inbox" }, lean).sort({ createdAt: 1 }).limit(limit).toArray(),
    (await lists()).find({ userId: uid, lastActivityAt: { $lt: new Date(now.getTime() - 30 * DAY) } }).sort({ lastActivityAt: 1 }).limit(limit).toArray(),
  ]);

  const site = (d: { siteName: string | null; url: string | null; kind: string }) =>
    d.siteName ?? (d.url ? new URL(d.url).hostname.replace(/^www\./, "") : d.kind[0]!.toUpperCase() + d.kind.slice(1));
  return {
    expiryDays: days,
    expiring: expiring.map((d) => ({
      id: d._id.toHexString(), title: d.title, site: site(d), movesOn: new Date(d.lastTouchedAt.getTime() + days! * DAY).toISOString(),
    })),
    due: due.map((d) => ({ id: d._id.toHexString(), title: d.title, dueAt: d.dueAt!.toISOString() })),
    oldest: oldest.map((d) => ({ id: d._id.toHexString(), title: d.title, site: site(d), createdAt: d.createdAt.toISOString() })),
    quietLists: quiet.map((l) => ({
      id: l._id.toHexString(), name: l.name, tickedCount: l.tickedCount, itemCount: l.itemCount,
      idleDays: Math.floor((now.getTime() - l.lastActivityAt.getTime()) / DAY),
    })),
  };
}

export const isEmptyDigest = (d: Digest) => !d.expiring.length && !d.due.length && !d.oldest.length && !d.quietLists.length;

type DueDigest = { userId: string; email: string; name: string; settings: UserSettings; localDate: string };

// People whose digest day it is, at or after 06:00 their time, not yet sent today. Claimed atomically, one person at a
// time: `each` (queueing their email) runs before the next person is claimed, so a failure or a killed tick part-way
// leaves everyone after it unclaimed for the next tick.
// shortcut: the one person claimed when `each` fails gets no email that week; claim and queue in one transaction if that shows up.
export async function claimDueDigests(now = new Date(), each?: (u: DueDigest) => Promise<unknown>): Promise<DueDigest[]> {
  const col = await users();
  // Missing settings mean the defaults (expiry and the email on), and `$ne: null` would skip a missing field.
  // shortcut: reads every person each minute; fine to tens of thousands, then keep a next-due time per person.
  const candidates = await col.find({ "settings.digestDay": { $not: { $type: "null" } } }, { projection: { email: 1, name: 1, settings: 1, digestSentOn: 1 } }).toArray();
  const due: DueDigest[] = [];
  for (const u of candidates) {
    const settings = { ...DEFAULT_SETTINGS, ...u.settings };
    if (settings.digestDay === null) continue;
    const local = localNow(now, settings.timezone);
    if (local.weekday !== settings.digestDay || local.hour < 6 || u.digestSentOn === local.date) continue;
    const claimed = await col.updateOne({ _id: u._id, digestSentOn: { $ne: local.date } }, { $set: { digestSentOn: local.date } });
    if (!claimed.modifiedCount) continue;
    const one = { userId: u._id.toHexString(), email: u.email, name: u.name ?? "", settings, localDate: local.date };
    await each?.(one);
    due.push(one);
  }
  return due;
}
