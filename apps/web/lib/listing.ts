import type { List, ListMembership } from "@pluck/shared-schemas";

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export async function fetchLists(): Promise<List[]> {
  const res = await fetch("/api/v1/lists");
  return res.ok ? ((await res.json()) as { lists: List[] }).lists : [];
}

export async function createListNamed(name: string): Promise<List | null> {
  const res = await send("/api/v1/lists", "POST", { name });
  return res.ok ? ((await res.json()) as { list: List }).list : null;
}

// In or out of a list, for one item or many.
export async function setInList(itemIds: string[], list: List, on: boolean): Promise<boolean> {
  if (on) return (await send(`/api/v1/lists/${list.id}/items`, "POST", { itemIds })).ok;
  const res = await Promise.all(itemIds.map((id) => send(`/api/v1/lists/${list.id}/items/${id}`, "DELETE")));
  return res.every((r) => r.ok || r.status === 404);
}

export async function membershipsOf(itemId: string): Promise<ListMembership[]> {
  const res = await fetch(`/api/v1/items/${itemId}?include=lists`);
  return res.ok ? ((await res.json()) as { lists: ListMembership[] }).lists : [];
}
