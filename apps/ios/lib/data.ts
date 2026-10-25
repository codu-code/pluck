import { ExtensionStorage } from "@bacons/apple-targets";
import type { CreateItemBody, Highlight, Item, ItemPage, List, ListEntry, ListMembership, Me, PluckResponse, SearchResults, Status, Tag } from "@pluck/shared-schemas";
import { onlineManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createQueue, Unreachable } from "@pluck/client";
import { KEEP, onWifi, plan, toKeep, type Kept } from "./keep";
import { kv } from "./kv";
import { api, authHeader, getSession } from "./session";

const GROUP: string = (Constants.expoConfig?.extra as { appGroup?: string } | undefined)?.appGroup ?? "group.io.getpluck.app";

// The cache survives restarts (persisted in lib/kv), so the app opens on what it last saw, offline too.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, gcTime: 7 * 86_400_000, retry: 1, networkMode: "offlineFirst" } },
});

// Queries pause with no connection (the reader shows what the phone kept) instead of failing, and pick up again when
// it comes back. React Native has no navigator.onLine, so the phone's network state tells TanStack Query.
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false));
  void Network.getNetworkStateAsync().then((s) => setOnline(s.isConnected !== false)).catch(() => {});
  return () => sub.remove();
});
const subscribe = (fn: () => void) => onlineManager.subscribe(fn);
export const useOnline = () => useSyncExternalStore(subscribe, () => onlineManager.isOnline());

export const keys = {
  items: (status: Status) => ["items", status] as const,
  item: (id: string) => ["item", id] as const,
  lists: ["lists"] as const,
  list: (id: string) => ["list", id] as const,
  tags: ["tags"] as const,
  me: ["me"] as const,
  search: (q: string, filters: object) => ["search", q, filters] as const,
  pending: ["pending"] as const,
};

export type FullItem = { item: Item; text: string; highlights: Highlight[]; lists: ListMembership[] };

export const useItems = (status: Status) =>
  useQuery({ queryKey: keys.items(status), queryFn: () => api<ItemPage>(`/api/v1/items?status=${status}&limit=50`) });
// While the page is still being plucked, ask again every few seconds so it shows up without leaving the screen.
// An Item kept for offline reading opens on its kept copy, and the server's copy replaces it once it can be fetched.
export const useItem = (id: string) =>
  useQuery({
    queryKey: keys.item(id),
    queryFn: () => api<FullItem>(`/api/v1/items/${id}?include=text,highlights,lists`),
    initialData: () => keptCopy(id),
    initialDataUpdatedAt: 0, // always stale, so it refreshes as soon as there is a connection
    refetchInterval: (q) => (q.state.data?.item.extraction.state === "pending" ? 3000 : false),
  });

// An item's cover: an image's picture, a page's preview image. Covers are private, so the request carries the signed-in header.
// `path` serves a cover from somewhere else, such as a List shared with you.
export function useCover(item: Pick<Item, "id" | "hasCover">, path?: string): { uri: string; headers: Record<string, string> } | null {
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!item.hasCover) return;
    let live = true;
    void (async () => {
      const s = await getSession();
      const auth = await authHeader();
      if (live && s && auth) setSrc({ uri: `${s.server}${path ?? `/api/v1/items/${item.id}/cover`}`, headers: { authorization: auth } });
    })();
    return () => void (live = false);
  }, [item.id, item.hasCover, path]);
  return src;
}
export const useLists = () => useQuery({ queryKey: keys.lists, queryFn: async () => (await api<{ lists: List[] }>("/api/v1/lists")).lists });
export const useList = (id: string) =>
  useQuery({ queryKey: keys.list(id), queryFn: () => api<{ list: List; entries: ListEntry[] }>(`/api/v1/lists/${id}`) });
export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: async () => (await api<{ tags: Tag[] }>("/api/v1/tags")).tags });
export const useCounts = () =>
  useQuery({ queryKey: ["counts"], queryFn: () => api<{ inbox: number; later: number; lists: number }>("/api/v1/counts") });
export const useMe = () => useQuery({ queryKey: keys.me, queryFn: async () => (await api<{ me: Me }>("/api/v1/me")).me });

export type SearchFilters = { kinds?: string[]; status?: Status; tagIds?: string[]; listId?: string; since?: string };
export const useSearch = (q: string, f: SearchFilters) =>
  useQuery({
    queryKey: keys.search(q, f),
    enabled: q.trim().length > 0,
    queryFn: () => {
      const p = new URLSearchParams({ q, limit: "30" });
      for (const k of f.kinds ?? []) p.append("kinds", k);
      for (const t of f.tagIds ?? []) p.append("tagIds", t);
      if (f.status) p.set("status", f.status);
      if (f.listId) p.set("listId", f.listId);
      if (f.since) p.set("since", f.since);
      return api<SearchResults>(`/api/v1/search?${p}`);
    },
  });

// One change to one item, applied to every cached copy at once and sent behind it.
export function usePatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api<{ item: Item }>(`/api/v1/items/${id}`, { method: "PATCH", json: patch }),
    onSuccess: ({ item }) => {
      qc.setQueryData<FullItem>(keys.item(item.id), (old) => (old ? { ...old, item } : old));
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["counts"] });
      void qc.invalidateQueries({ queryKey: keys.lists });
    },
  });
}

// ---- Plucks made on the phone, and the queue for when there is no connection ------------------------------

const queue = createQueue({ read: () => kv.get("queue", []), write: (q) => kv.set("queue", q) });

export async function pluck(body: CreateItemBody): Promise<{ item: Item | null; queued: boolean }> {
  try {
    const res = await api<PluckResponse>("/api/v1/items", { json: { source: "ios", ...body } });
    void queryClient.invalidateQueries({ queryKey: ["items"] });
    return { item: res.results[0]?.item ?? null, queued: false };
  } catch (e) {
    if (!(e instanceof Unreachable)) throw e;
    await queue.add({ source: "ios", ...body });
    void queryClient.invalidateQueries({ queryKey: keys.pending });
    return { item: null, queued: true };
  }
}

// What the share extension could not send (no connection) waits as files in the App Group container.
const pendingDir = () => {
  const container = Paths.appleSharedContainers[GROUP];
  return container ? new Directory(container, "pending") : null;
};

// How many plucks wait to go up: the sync pill, merged into the offline pill when there is no connection.
export const usePending = () => useQuery({ queryKey: keys.pending, queryFn: toSync, networkMode: "always", staleTime: 0 });

export async function toSync(): Promise<number> {
  const dir = pendingDir();
  const shared = dir?.exists ? dir.list().filter((f) => f instanceof File && f.name.endsWith(".json")).length : 0;
  return (await queue.count()) + shared;
}

type SharedRecord = { body?: CreateItemBody; file?: { name: string; contentType: string; path: string } };

// Runs when the app comes to the foreground: the phone's queue, then the share extension's leftovers.
// One run at a time: opening the app and pulling to refresh must not send the same share twice.
let syncing: Promise<number> | null = null;
export const syncPending = (): Promise<number> => (syncing ??= sync().finally(() => (syncing = null)));

async function sync(): Promise<number> {
  await queue.drain((body) => api("/api/v1/items", { json: body }));
  const dir = pendingDir();
  if (dir?.exists) {
    for (const f of dir.list()) {
      if (!(f instanceof File) || !f.name.endsWith(".json")) continue;
      let record: SharedRecord | null = null;
      try {
        record = JSON.parse(await f.text()) as SharedRecord;
        if (record.body) await api("/api/v1/items", { json: record.body });
        if (record.file) await uploadShared(record.file);
        f.delete();
      } catch (e) {
        if (e instanceof Unreachable) break; // still offline: try next time
        f.delete(); // refused or unreadable: retrying will not help
        if (record?.file) removeShared(record.file.path);
      }
    }
  }
  void queryClient.invalidateQueries({ queryKey: ["items"] });
  void queryClient.invalidateQueries({ queryKey: keys.pending });
  return toSync();
}

async function uploadShared(file: { name: string; contentType: string; path: string }) {
  const container = Paths.appleSharedContainers[GROUP];
  if (!container) return;
  const local = new File(container, file.path);
  if (!local.exists) return;
  const { uploadUrl } = await api<{ uploadUrl: string }>("/api/v1/items/files", { json: { name: file.name, contentType: file.contentType, size: local.size ?? 1, source: "ios" } });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.contentType }, body: await local.bytes() }).catch(() => null);
  if (!res?.ok) throw new Unreachable("upload failed"); // a dropped connection too: keep the share and try again
  local.delete();
}

function removeShared(path: string) {
  const container = Paths.appleSharedContainers[GROUP];
  const local = container ? new File(container, path) : null;
  if (local?.exists) local.delete();
}

// The share extension shows two of your tags and "Add to <last list>"; it reads them from the App Group.
export function shareExtensionCache(tags: Tag[], lists: List[]) {
  const storage = new ExtensionStorage(GROUP);
  const last = [...lists].sort((a, b) => (b.lastAddedAt ?? "").localeCompare(a.lastAddedAt ?? ""))[0];
  storage.set("tags", JSON.stringify([...tags].sort((a, b) => b.count - a.count).slice(0, 12).map((t) => ({ id: t.id, name: t.name }))));
  storage.set("lastList", last ? JSON.stringify({ id: last.id, name: last.name }) : undefined);
}

// ---- Keep for offline reading ------------------------------------------------------------------------------
// On Wi-Fi, the text of the newest 300 Items in Inbox, Later and Lists, one key each beside the query cache (which is
// written whole on every change, so it stays small), and the Lists themselves. Text only: no pictures.

const keptKey = (id: string) => `kept:${id}`;
const keptCopy = (id: string): FullItem | undefined => kv.getSync<FullItem | undefined>(keptKey(id), undefined);
export const keepSetting = () => kv.get("keepOffline", true);

export async function keptSize(): Promise<{ ids: string[]; bytes: number }> {
  const kept = await kv.get<Kept>("kept", {});
  return { ids: Object.keys(kept), bytes: Object.values(kept).reduce((n, k) => n + k.bytes, 0) };
}

export async function clearKept(): Promise<void> {
  const kept = await kv.get<Kept>("kept", {});
  for (const id of Object.keys(kept)) await kv.remove(keptKey(id));
  await kv.remove("kept");
}

export async function setKeepSetting(on: boolean): Promise<void> {
  await kv.set("keepOffline", on);
  if (on) await keepForOffline(true);
  else await clearKept();
}

// One run at a time, and at most every 15 minutes unless asked (turning the setting on).
let keeping: Promise<void> | null = null;
let keptAt = 0;
export const keepForOffline = (force = false): Promise<void> =>
  (keeping ??= keep(force).catch(() => {}).finally(() => (keeping = null))); // offline or refused: next time

const wifi = async () => onWifi(await Network.getNetworkStateAsync());
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function keep(force: boolean) {
  if ((!force && Date.now() - keptAt < 15 * 60_000) || !(await keepSetting()) || !(await wifi())) return;
  const items: Item[] = [];
  for (const status of ["inbox", "later"] as const) {
    let cursor: string | null = null;
    let got = 0;
    do {
      const page: ItemPage = await api<ItemPage>(`/api/v1/items?status=${status}&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      items.push(...page.items);
      got += page.items.length;
      cursor = page.nextCursor;
    } while (cursor && got < KEEP);
  }
  const lists = (await api<{ lists: List[] }>("/api/v1/lists")).lists;
  queryClient.setQueryData(keys.lists, lists);
  for (const l of lists) {
    const one = await api<{ list: List; entries: ListEntry[] }>(`/api/v1/lists/${l.id}`);
    queryClient.setQueryData(keys.list(l.id), one); // the List itself opens offline too
    items.push(...one.entries.map((e) => e.item));
  }

  const kept = await kv.get<Kept>("kept", {});
  const { fetch, drop } = plan(toKeep(items), kept);
  try {
    for (const id of drop) {
      await kv.remove(keptKey(id));
      delete kept[id];
    }
    for (const item of fetch) {
      if (!(await wifi()) || !(await keepSetting())) break; // off the Wi-Fi, or turned off: stop here
      const raw = JSON.stringify(await api<FullItem>(`/api/v1/items/${item.id}?include=text,highlights,lists`));
      await kv.storage.setItem(keptKey(item.id), raw);
      kept[item.id] = { updatedAt: item.updatedAt, bytes: raw.length };
      await pause(250); // gently: well under the API's 600 reads a minute, with room for the app itself
    }
    keptAt = Date.now();
  } finally {
    if (await keepSetting()) await kv.set("kept", kept);
    else for (const id of Object.keys(kept)) await kv.remove(keptKey(id)); // turned off meanwhile: leave nothing behind
  }
}
