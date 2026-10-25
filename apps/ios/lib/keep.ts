import { isTextKind, type Item } from "@pluck/shared-schemas";

// Keep for offline reading: on Wi-Fi, the phone keeps the text of the newest Items in Inbox, Later and Lists.
// Pure (no Expo imports), so the root `pnpm test` covers it; lib/data.ts does the fetching and the storing.
export const KEEP = 300;

// What has been kept: each Item's id, the updatedAt of the copy, and its size in bytes.
export type Kept = Record<string, { updatedAt: string; bytes: number }>;

// Wi-Fi or a cable only, never mobile data. expo-network's state, kept as it comes.
export const onWifi = (n: { type?: string; isInternetReachable?: boolean }) =>
  (n.type === "WIFI" || n.type === "ETHERNET") && n.isInternetReachable !== false;

// The newest Items that have text to read, each once. Images have none; a page still being plucked, or one that
// could not be read, has none yet.
export function toKeep(items: Item[], limit = KEEP): Item[] {
  const byId = new Map<string, Item>();
  for (const i of items) if (i.kind !== "image" && (i.extraction.state === "done" || isTextKind(i.kind))) byId.set(i.id, i);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

// What to fetch (not kept yet, or changed since) and what to let go (no longer among the newest).
export function plan(keep: Item[], kept: Kept): { fetch: Item[]; drop: string[] } {
  const wanted = new Set(keep.map((i) => i.id));
  return {
    fetch: keep.filter((i) => kept[i.id]?.updatedAt !== i.updatedAt),
    drop: Object.keys(kept).filter((id) => !wanted.has(id)),
  };
}
