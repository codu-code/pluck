import { claimDueDigests, digestFor, editItem, getMe, isEmptyDigest, markOpened, updateSettings } from "@pluck/db";
import type { Digest } from "@pluck/shared-schemas";
import { digestEmail } from "../digest-email";
import { sendEmail } from "../email";
import { ApiError } from "../errors";
import { log } from "../log";
import { signTap, verifyTap, type Tap } from "../signed";
import { archiveItAll } from "./expiry";

const origin = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function digest(userId: string, { limit = 5 }: { limit?: number } = {}): Promise<Digest> {
  const me = await getMe(userId);
  if (!me) throw new ApiError("not_found", "No such account.", 404);
  return digestFor(userId, me.settings, new Date(), limit);
}

// Builds and sends one person's digest. Nothing to say means no email.
export async function sendDigest(userId: string, { force = false }: { force?: boolean } = {}): Promise<boolean> {
  const me = await getMe(userId);
  if (!me) return false;
  const d = await digestFor(userId, me.settings);
  if (isEmptyDigest(d) && !force) return false;
  const tap = (a: Tap["a"], i?: string) => `${origin()}/d/${signTap({ u: userId, a, i })}`;
  await sendEmail(
    digestEmail(me.email, me.name, d, {
      keep: (id) => tap("keep", id),
      letGo: (id) => tap("letgo", id),
      open: (id) => `${origin()}/items/${id}`,
      list: (id) => `${origin()}/lists/${id}`,
      archiveAll: tap("archive-all"),
      settings: `${origin()}/settings#expiry`,
      stop: tap("stop"),
    }),
  );
  return true;
}

// Monday 06:00 local (or the person's chosen day), once.
export async function sendDueDigests(now = new Date()): Promise<number> {
  let sent = 0;
  for (const u of await claimDueDigests(now)) {
    try {
      if (await sendDigest(u.userId)) sent++;
    } catch (e) {
      log("error", "digest failed", { userId: u.userId, error: String(e) });
    }
  }
  return sent;
}

export type TapResult = { action: Tap["a"]; ok: boolean; undo?: string; count?: number };

// What a signed link does. Archive it all is only a count here; it moves things on the confirm page's POST.
export async function runTap(token: string, { confirm = false }: { confirm?: boolean } = {}): Promise<TapResult> {
  const tap = verifyTap(token);
  if (!tap) throw new ApiError("forbidden", "This link has expired. Links in the email work for 7 days.", 403);
  switch (tap.a) {
    case "keep":
      await markOpened(tap.u, tap.i!);
      return { action: "keep", ok: true };
    case "letgo":
      await editItem(tap.u, tap.i!, { status: "archived" });
      return { action: "letgo", ok: true, undo: signTap({ u: tap.u, a: "undo-letgo", i: tap.i }) };
    case "undo-letgo":
      await editItem(tap.u, tap.i!, { status: "inbox" });
      return { action: "undo-letgo", ok: true };
    case "stop":
      await updateSettings(tap.u, { digestDay: null });
      return { action: "stop", ok: true };
    case "archive-all": {
      const res = await archiveItAll(tap.u, { dryRun: !confirm });
      return { action: "archive-all", ok: true, count: res.count };
    }
  }
}
