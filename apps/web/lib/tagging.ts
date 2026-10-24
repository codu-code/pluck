import type { Item, Tag } from "@pluck/shared-schemas";

const send = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch("/api/v1/tags");
  return res.ok ? ((await res.json()) as { tags: Tag[] }).tags : [];
}

export async function createTagNamed(name: string): Promise<Tag | null> {
  const res = await send("/api/v1/tags", "POST", { name });
  return res.ok ? ((await res.json()) as { tag: Tag }).tag : null;
}

// Turns a tag on or off for some items: one item gets its whole new set (so every tag on it becomes
// the person's), many get one batch add or remove. Returns the items as they are now.
export async function setTagOn(ids: string[], tag: Tag, on: boolean, known: Item[]): Promise<Item[] | null> {
  if (ids.length === 1) {
    const current = known.find((i) => i.id === ids[0]);
    const tagIds = on ? [...new Set([...(current?.tagIds ?? []), tag.id])] : (current?.tagIds ?? []).filter((t) => t !== tag.id);
    const res = await send(`/api/v1/items/${ids[0]}`, "PATCH", { tagIds });
    return res.ok ? [((await res.json()) as { item: Item }).item] : null;
  }
  const res = await send("/api/v1/items/batch", "POST", { itemIds: ids, patch: on ? { addTagIds: [tag.id] } : { removeTagIds: [tag.id] } });
  if (!res.ok) return null;
  const fresh = await Promise.all(ids.map((id) => fetch(`/api/v1/items/${id}`).then((r) => (r.ok ? r.json() : null))));
  return fresh.filter(Boolean).map((f) => (f as { item: Item }).item);
}
