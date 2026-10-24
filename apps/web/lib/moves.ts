import type { Item, Status } from "@pluck/shared-schemas";

// Status moves from the apps: one item through PATCH, many through the batch route.
export async function moveItems(ids: string[], status: Status): Promise<boolean> {
  const res =
    ids.length === 1
      ? await fetch(`/api/v1/items/${ids[0]}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) })
      : await fetch("/api/v1/items/batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemIds: ids, patch: { status } }) });
  if (res.ok) window.dispatchEvent(new Event("pluck:counts"));
  return res.ok;
}

// Undo puts each item back where it was, grouped so it is one call per status.
export async function restoreStatuses(items: Pick<Item, "id" | "status">[]): Promise<void> {
  const by = new Map<Status, string[]>();
  for (const it of items) by.set(it.status, [...(by.get(it.status) ?? []), it.id]);
  await Promise.all([...by].map(([status, ids]) => moveItems(ids, status)));
}

export const MOVED: Record<Status, string> = {
  archived: "Gone. Well, archived.",
  later: "Kept for later.",
  done: "Done.",
  inbox: "Back in the Inbox.",
};
