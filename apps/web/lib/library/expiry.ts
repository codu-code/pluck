import { archiveStale, countExpiringSoon, getMe } from "@pluck/db";
import type { Status } from "@pluck/shared-schemas";
import { ApiError } from "../errors";

// "Archive it all. No, really.": Inbox (and Later, by scope) untouched for longer than the expiry length
// move to the Archive now. Lists are left alone. Nothing is deleted.
export async function archiveItAll(userId: string, { olderThanDays, dryRun }: { olderThanDays?: number; dryRun: boolean }): Promise<{ count: number; olderThanDays: number }> {
  const me = await getMe(userId);
  if (!me) throw new ApiError("not_found", "No such account.", 404);
  const days = olderThanDays ?? me.settings.expiryDays ?? 30;
  return { count: await archiveStale(userId, { olderThanDays: days, scope: me.settings.expiryScope, dryRun }), olderThanDays: days };
}

export async function expiringSoon(userId: string, statuses: Status[]): Promise<number> {
  const me = await getMe(userId);
  return me ? countExpiringSoon(userId, me.settings, statuses) : 0;
}
