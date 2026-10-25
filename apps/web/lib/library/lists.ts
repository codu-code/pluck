import {
  addToList, createList, deleteList, getList, getListMeta, listLists, markEntries, removeFromList, reorderList, updateEntry, updateList,
} from "@pluck/db";
import type { List, ListEntry } from "@pluck/shared-schemas";
import { ApiError } from "../errors";
import type { Actor } from "./tags";

const missing = () => new ApiError("not_found", "No such list.", 404);

export const listsOf = (userId: string): Promise<List[]> => listLists(userId);

export async function newList(
  userId: string,
  body: { name: string; purpose?: string; items?: { itemId: string; note?: string | null }[] },
  { by = "user" }: { by?: Actor } = {},
): Promise<List> {
  return createList(userId, { ...body, createdBy: by });
}

export async function readList(userId: string, listId: string): Promise<{ list: List; entries: ListEntry[] }> {
  const res = await getList(userId, listId);
  if (!res) throw missing();
  return res;
}

export async function editList(userId: string, listId: string, edit: { name?: string; purpose?: string }): Promise<List> {
  const res = await updateList(userId, listId, edit);
  if (!res) throw missing();
  return res;
}

export async function removeList(userId: string, listId: string): Promise<void> {
  if (!(await deleteList(userId, listId))) throw missing();
}

export async function addItems(
  userId: string,
  listId: string,
  itemIds: string[],
  opts: { note?: string | null; position?: number; by?: Actor } = {},
): Promise<{ added: number }> {
  const added = await addToList(userId, listId, itemIds, { ...opts, by: opts.by ?? "user" });
  if (added === null) throw missing();
  return { added };
}

export async function removeItem(userId: string, listId: string, itemId: string): Promise<void> {
  if (!(await removeFromList(userId, listId, itemId))) throw new ApiError("not_found", "That item is not in this list.", 404);
}

export async function editEntry(
  userId: string,
  listId: string,
  itemId: string,
  edit: { note?: string | null; ticked?: boolean; position?: number },
  { by = "user" }: { by?: Actor } = {},
): Promise<void> {
  if (!(await updateEntry(userId, listId, itemId, edit, by))) throw new ApiError("not_found", "That item is not in this list.", 404);
}

// Bulk select: mark or unmark many rows at once. A Todo or Thing follows with its Done.
export async function markMany(userId: string, listId: string, itemIds: string[], ticked: boolean): Promise<{ marked: number }> {
  const marked = await markEntries(userId, listId, itemIds, ticked);
  if (marked === null) throw missing();
  return { marked };
}

export async function reorder(userId: string, listId: string, itemIds: string[]): Promise<void> {
  if (!(await getListMeta(userId, listId))) throw missing();
  if (!(await reorderList(userId, listId, itemIds))) throw new ApiError("bad_request", "Send every item in the list, in the new order.", 400);
}

// One list as JSON plus Markdown: title, purpose, then each item with its link and note.
export async function exportList(userId: string, listId: string): Promise<{ list: List; entries: ListEntry[]; markdown: string }> {
  const { list, entries } = await readList(userId, listId);
  const lines = [`# ${list.name}`, ...(list.purpose ? ["", list.purpose] : []), ""];
  entries.forEach((e, i) => {
    const title = e.item.url ? `[${e.item.title}](${e.item.url})` : e.item.title;
    lines.push(`${i + 1}. ${e.ticked ? "~~" : ""}${title}${e.ticked ? "~~" : ""}`);
    if (e.note) lines.push(`   ${e.note}`);
  });
  return { list, entries, markdown: `${lines.join("\n")}\n` };
}
