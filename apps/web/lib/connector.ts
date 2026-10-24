import type { PluckLibrary } from "@pluck/mcp-server";
import {
  addItems, addTag, batch, browse, deleteItem, digest, editEntry, editList, highlightsOf, membershipsOf, newList, pluckAny, readItem, readList,
  readText, removeItem, reorder, search, setListVisibility, tagsOf, listsOf,
} from "./library";

type Defer = (task: () => Promise<void>) => void;

// The library as one person's AI tool sees it: bound to them, every write marked "by AI".
export function connectorFor(userId: string, { defer }: { defer?: Defer } = {}): PluckLibrary {
  const by = "mcp" as const;
  return {
    search: (q) => search(userId, q),
    browse: (q) => browse(userId, q),
    item: (id) => readItem(userId, id),
    text: (id) => readText(userId, id),
    highlights: (id) => highlightsOf(userId, id),
    memberships: (id) => membershipsOf(userId, id),
    pluck: (body) => pluckAny(userId, body, { defer }),
    batch: (body) => batch(userId, body, { by }),
    tags: () => tagsOf(userId),
    createTag: (name) => addTag(userId, name, { by }),
    lists: () => listsOf(userId),
    list: (id) => readList(userId, id),
    createList: (body) => newList(userId, body, { by }),
    renameList: async (id, name) => void (await editList(userId, id, { name })),
    addToList: async (id, itemIds, note) => void (await addItems(userId, id, itemIds, { note, by })),
    removeFromList: (id, itemId) => removeItem(userId, id, itemId),
    editEntry: (id, itemId, edit) => editEntry(userId, id, itemId, edit, { by }),
    reorder: (id, itemIds) => reorder(userId, id, itemIds),
    setVisibility: async (id, visibility) => void (await setListVisibility(userId, id, visibility)),
    digest: (limit) => digest(userId, { limit }),
    deleteItem: (id) => deleteItem(userId, id),
  };
}
