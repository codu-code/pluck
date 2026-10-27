import type { Item, List, ListEntry, ListMembership, Status, Tag, UpdateItemBody } from "@pluck/shared-schemas";
import { Refused, type Client } from "./api";

// The library actions the web and the iPhone app both take: each owns its route and body, and fails the way
// `answer` says (Refused, SignedOut, Unreachable). What a screen refreshes afterwards stays with the app.
export function createLibrary(call: Client) {
  const move = (ids: string[], status: Status) =>
    ids.length === 1
      ? call(`/api/v1/items/${ids[0]}`, { method: "PATCH", json: { status } })
      : call("/api/v1/items/batch", { json: { itemIds: ids, patch: { status } } });
  const mark = (listId: string, ids: string[], ticked: boolean) =>
    ids.length === 1
      ? call(`/api/v1/lists/${listId}/items/${ids[0]}`, { method: "PATCH", json: { ticked } })
      : call(`/api/v1/lists/${listId}/items`, { method: "PATCH", json: { itemIds: ids, ticked } });
  return {
    // Status moves: one Item through PATCH, many through the batch route.
    move,
    // Undo puts each Item back where it was, one call per Status.
    restore: async (items: Pick<Item, "id" | "status">[]) => {
      const by = new Map<Status, string[]>();
      for (const it of items) by.set(it.status, [...(by.get(it.status) ?? []), it.id]);
      await Promise.all([...by].map(([status, ids]) => move(ids, status)));
    },
    edit: async (id: string, patch: UpdateItemBody) => (await call<{ item: Item }>(`/api/v1/items/${id}`, { method: "PATCH", json: patch })).item,
    remove: (id: string) => call(`/api/v1/items/${id}`, { method: "DELETE" }), // to the bin
    fromBin: (id: string) => call(`/api/v1/items/${id}/restore`, { method: "POST" }),
    forever: (id: string) => call(`/api/v1/items/${id}/forever`, { method: "DELETE" }),

    tags: async () => (await call<{ tags: Tag[] }>("/api/v1/tags")).tags,
    newTag: async (name: string) => (await call<{ tag: Tag }>("/api/v1/tags", { json: { name } })).tag,
    renameTag: (id: string, name: string) => call(`/api/v1/tags/${id}`, { method: "PATCH", json: { name } }),
    // Into another Tag (a merge), or off every Item.
    deleteTag: (id: string, into?: string) => call(`/api/v1/tags/${id}?${into ? `reassignTo=${into}` : "removeFromItems=true"}`, { method: "DELETE" }),
    // One Item gets its whole new set (so every Tag on it becomes the person's), many get one batch add or remove.
    // Returns the Items as they are now; `known` holds their Tags before.
    setTag: async <I extends Pick<Item, "id" | "tagIds">>(ids: string[], tagId: string, on: boolean, known: I[]): Promise<(I | Item)[]> => {
      const next = (tagIds: string[]) => (on ? [...new Set([...tagIds, tagId])] : tagIds.filter((t) => t !== tagId));
      if (ids.length === 1) return [(await call<{ item: Item }>(`/api/v1/items/${ids[0]}`, { method: "PATCH", json: { tagIds: next(known.find((i) => i.id === ids[0])?.tagIds ?? []) } })).item];
      await call("/api/v1/items/batch", { json: { itemIds: ids, patch: on ? { addTagIds: [tagId] } : { removeTagIds: [tagId] } } });
      // The batch did exactly this to each Item, so apply it here rather than fetching every Item back.
      return known.filter((i) => ids.includes(i.id)).map((i) => ({ ...i, tagIds: next(i.tagIds) }));
    },

    lists: async () => (await call<{ lists: List[] }>("/api/v1/lists")).lists,
    memberships: async (itemId: string) => (await call<{ lists: ListMembership[] }>(`/api/v1/items/${itemId}?include=lists`)).lists,
    newList: async (name: string, itemIds: string[] = []) =>
      (await call<{ list: List }>("/api/v1/lists", { json: { name, ...(itemIds.length ? { items: itemIds.map((itemId) => ({ itemId })) } : {}) } })).list,
    // In or out of a List, for one Item or many. Out of one it is not in counts as done.
    setInList: async (ids: string[], listId: string, on: boolean) => {
      if (on) return void (await call(`/api/v1/lists/${listId}/items`, { json: { itemIds: ids } }));
      await Promise.all(ids.map((id) => call(`/api/v1/lists/${listId}/items/${id}`, { method: "DELETE" }).catch((e: unknown) => {
        if (!(e instanceof Refused && e.status === 404)) throw e;
      })));
    },
    // Marks one row or many. A Todo or Thing is Done when marked (the server keeps the two in step).
    mark,
    reorder: (listId: string, ids: string[]) => call(`/api/v1/lists/${listId}/reorder`, { json: { itemIds: ids } }),
    // Undo for taking rows out: each back in its place with its note, and marked again if it was.
    putBack: async (listId: string, entries: (Pick<ListEntry, "position" | "note" | "ticked"> & { item: Pick<Item, "id"> })[]) => {
      for (const e of entries) await call(`/api/v1/lists/${listId}/items`, { json: { itemId: e.item.id, position: e.position, note: e.note } });
      const ticked = entries.filter((e) => e.ticked).map((e) => e.item.id);
      if (ticked.length) await call(`/api/v1/lists/${listId}/items`, { method: "PATCH", json: { itemIds: ticked, ticked: true } });
    },
  };
}

export type Library = ReturnType<typeof createLibrary>;
