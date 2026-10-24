import { holdTry, takeTry } from "@pluck/db";
import { extractUrls, type PluckResponse } from "@pluck/shared-schemas";
import { ApiError } from "../errors";
import { pluckAny } from "./items";

const PER_PASTE = 5; // "Paste a link. Or five."

// The home page paste box for a visitor: the links are held for a day, nothing is fetched until they sign up.
export async function holdPaste(token: string | null, text: string): Promise<{ token: string; count: number; held: number }> {
  const urls = extractUrls(text).slice(0, PER_PASTE);
  if (!urls.length) throw new ApiError("bad_request", "Paste a link that starts with http, or www.", 400);
  const held = await holdTry(token, urls);
  return { ...held, held: urls.length };
}

// After sign-up (or sign-in) in the same browser: the held links become the person's items.
export async function claimPaste(userId: string, token: string, { defer }: { defer?: (task: () => Promise<void>) => void } = {}): Promise<PluckResponse | null> {
  const urls = await takeTry(token);
  return urls.length ? pluckAny(userId, { urls, source: "web" }, { defer }) : null;
}
