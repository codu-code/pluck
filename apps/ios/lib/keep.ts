import { isTextKind, type Item } from "@pluck/shared-schemas";

// Kept on this iPhone: on Wi-Fi, the phone keeps the newest Items in Inbox, Later and Lists, and every Item kept by
// hand (which stays until let go). Each keeps its text and its picture; a PDF kept by hand keeps its file.
// Pure (no Expo imports), so the root `pnpm test` covers it; lib/data.ts does the fetching and the storing.
export const KEEP = 300;
export const MAX_BYTES = 500_000_000; // pictures and files stop here; the oldest automatic copies lose theirs first

// What has been kept: each Item's id, the updatedAt of the copy, its size in bytes, and the bytes of its picture
// or file (on disk beside it) when it has one.
export type Kept = Record<string, { updatedAt: string; bytes: number; media?: number }>;

// Wi-Fi or a cable only, never mobile data. expo-network's state, kept as it comes.
export const onWifi = (n: { type?: string; isInternetReachable?: boolean }) =>
  (n.type === "WIFI" || n.type === "ETHERNET") && n.isInternetReachable !== false;

// Items kept by hand first, then the newest that have text to read, each once. Images have no text (one kept by hand
// still keeps its picture); a page still being plucked, or one that could not be read, has none yet.
export function toKeep(items: Item[], byHand: ReadonlySet<string> = new Set(), limit = KEEP): Item[] {
  const byId = new Map<string, Item>();
  for (const i of items) if (byHand.has(i.id) || (i.kind !== "image" && (i.extraction.state === "done" || isTextKind(i.kind)))) byId.set(i.id, i);
  const all = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...all.filter((i) => byHand.has(i.id)), ...all.filter((i) => !byHand.has(i.id)).slice(0, limit)];
}

// What to fetch (not kept yet, or changed since) and what to let go (no longer among the newest, nor kept by hand).
export function plan(keep: Item[], kept: Kept, byHand: ReadonlySet<string> = new Set()): { fetch: Item[]; drop: string[] } {
  const wanted = new Set(keep.map((i) => i.id));
  return {
    fetch: keep.filter((i) => kept[i.id]?.updatedAt !== i.updatedAt),
    drop: Object.keys(kept).filter((id) => !wanted.has(id) && !byHand.has(id)),
  };
}

// Over the cap, the pictures to let go of: the oldest automatic copies first, never one kept by hand. `order` is
// newest first (toKeep's order).
export function overCap(order: string[], kept: Kept, byHand: ReadonlySet<string>, max = MAX_BYTES): string[] {
  let total = Object.values(kept).reduce((n, k) => n + k.bytes + (k.media ?? 0), 0);
  const out: string[] = [];
  for (const id of [...order].reverse()) {
    if (total <= max) break;
    const k = kept[id];
    if (!k?.media || byHand.has(id)) continue;
    total -= k.media;
    out.push(id);
  }
  return out;
}
