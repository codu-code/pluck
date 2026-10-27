import type {
  BatchBody, CreateItemBody, Digest, Highlight, Item, ItemPage, List, ListEntry, ListItemsQuery, ListMembership, PluckResponse,
  SearchQuery, SearchResults, Tag,
} from "@pluck/shared-schemas";

// One person's library as the connector sees it: already bound to the caller, and every write marked as made by AI.
// apps/web binds it to the in-process library; the tools never touch HTTP or the database.
// Errors carry `{ code, message, details? }` (the library's ApiError) and are handed back to the AI tool as they are.
export interface PluckLibrary {
  search(q: SearchQuery): Promise<SearchResults>;
  browse(q: ListItemsQuery): Promise<ItemPage>;
  item(id: string): Promise<Item>;
  text(id: string): Promise<string>;
  highlights(id: string): Promise<Highlight[]>;
  memberships(id: string): Promise<ListMembership[]>;
  pluck(body: CreateItemBody): Promise<PluckResponse>;
  batch(body: BatchBody): Promise<{ matched: number; updated: number }>;
  tags(): Promise<Tag[]>;
  tagIdsFor(refs: string[]): Promise<string[]>; // ids or names of existing Tags; unknown ones throw unknown_tags with the nearest
  createTag(name: string): Promise<{ tag: Tag; created: boolean }>;
  lists(): Promise<List[]>;
  list(id: string): Promise<{ list: List; entries: ListEntry[] }>;
  createList(body: { name: string; purpose?: string; items?: { itemId: string; note?: string | null }[] }): Promise<List>;
  renameList(id: string, name: string): Promise<void>;
  addToList(id: string, itemIds: string[], note?: string | null): Promise<void>;
  removeFromList(id: string, itemId: string): Promise<void>;
  editEntry(id: string, itemId: string, edit: { note?: string | null; ticked?: boolean }): Promise<void>;
  reorder(id: string, itemIds: string[]): Promise<void>;
  makePrivate(id: string): Promise<void>; // there is no way to make a List public here: only the person does that, in Pluck
  digest(limit: number): Promise<Digest>;
  deleteItem(id: string): Promise<void>;
}
