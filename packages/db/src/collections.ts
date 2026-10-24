import type { ArchivedReason, ExtractionState, Kind, Source, Status } from "@pluck/shared-schemas";
import { ObjectId, type Collection, type Db } from "mongodb";
import type { z } from "zod";
import { getDb } from "./client.ts";

export type ItemDoc = {
  _id: ObjectId;
  userId: ObjectId;
  kind: Kind;
  url: string | null;
  urlHash?: string; // absent for notes, todos and things
  canonicalUrl: string | null;
  title: string;
  titleIsDerived: boolean;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  coverKey: string | null;
  htmlKey: string | null;
  status: Status;
  archivedReason: z.infer<typeof ArchivedReason> | null;
  dueAt: Date | null;
  tagIds: ObjectId[];
  aiTags?: { tagId: ObjectId; at: Date }[]; // assignments made by an AI tool, until the person touches the item's tags
  note: string | null;
  source: Source;
  readingProgress: number;
  wordCount: number | null;
  lang: string | null;
  extraction: { state: z.infer<typeof ExtractionState>; attempts: number; lastError: string | null };
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date | null;
  lastTouchedAt: Date;
  statusChangedAt: Date; // when it last moved between Inbox, Later, Archived and Done
  // Search fields, kept in step by the writes that change them (see search.ts):
  tagNames?: string[];
  listNames?: string[];
  searchText?: string; // excerpt, site, host, author
  searchBody?: string; // the kept text or the note body, capped
  deletedAt: Date | null; // in the bin; purged 30 days later
};

export type TagDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  slug: string;
  colour: string;
  count: number;
  createdAt: Date;
  createdBy: "user" | "mcp";
};

export type ListDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  slug: string;
  purpose: string;
  visibility: "private" | "public";
  itemCount: number;
  tickedCount: number;
  views: number;
  lastAddedAt: Date | null;
  lastActivityAt: Date;
  createdBy: "user" | "mcp";
  createdAt: Date;
  updatedAt: Date;
};

export type ListItemDoc = {
  _id: ObjectId;
  listId: ObjectId;
  userId: ObjectId;
  itemId: ObjectId;
  position: number;
  note: string | null;
  noteBy: "user" | "mcp" | null;
  ticked: boolean;
  tickedAt: Date | null;
  addedBy: "user" | "mcp";
  addedAt: Date;
};

export type HighlightDoc = {
  _id: ObjectId;
  userId: ObjectId;
  itemId: ObjectId;
  quote: string;
  note: string | null;
  selector: { textQuote: { exact: string; prefix: string; suffix: string }; textPosition: { start: number; end: number } };
  createdAt: Date;
};

export type ContentDoc = {
  _id: ObjectId;
  itemId: ObjectId;
  userId: ObjectId;
  textMarkdown: string;
  extractor: string;
  bytes: number;
};

export type JobDoc = {
  _id: ObjectId;
  queue: string;
  payload: Record<string, unknown>;
  state: "queued" | "running" | "done" | "failed";
  attempts: number;
  visibleAt: Date;
  lastError: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

export type RateLimitDoc = { _id: string; count: number; expireAt: Date };

let ready: Promise<Db> | undefined;

// Indexes are created once per process, before the first query.
export function db(): Promise<Db> {
  return (ready ??= (async () => {
    const d = getDb();
    await Promise.all([
      d.collection("items").createIndexes([
        { key: { userId: 1, status: 1, createdAt: -1 } },
        { key: { userId: 1, status: 1, lastTouchedAt: 1 } },
        { key: { userId: 1, urlHash: 1 }, unique: true, partialFilterExpression: { urlHash: { $type: "string" } } },
        { key: { userId: 1, tagIds: 1, createdAt: -1 } },
        { key: { userId: 1, kind: 1, dueAt: 1 } },
        { key: { "extraction.state": 1, updatedAt: 1 } },
        { key: { userId: 1, status: 1, statusChangedAt: -1 } },
        { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: { $type: "date" } } },
        {
          key: { title: "text", note: "text", tagNames: "text", listNames: "text", searchText: "text", searchBody: "text" },
          name: "search",
          weights: { title: 10, note: 5, tagNames: 5, listNames: 3, searchText: 2, searchBody: 1 },
          default_language: "english",
          language_override: "searchLanguage", // items carry `lang` for display; never let it switch stemming
        },
      ]),
      d.collection("lists").createIndexes([
        { key: { userId: 1, slug: 1 }, unique: true },
        { key: { userId: 1, updatedAt: -1 } },
        { key: { userId: 1, lastActivityAt: 1 } },
      ]),
      d.collection("listItems").createIndexes([
        { key: { listId: 1, position: 1 } },
        { key: { itemId: 1 } },
        { key: { userId: 1, itemId: 1, listId: 1 }, unique: true },
      ]),
      d.collection("tags").createIndexes([{ key: { userId: 1, slug: 1 }, unique: true }]),
      d.collection("highlights").createIndexes([{ key: { userId: 1, itemId: 1, createdAt: 1 } }]),
      d.collection("contents").createIndexes([{ key: { itemId: 1 }, unique: true }]),
      d.collection("jobs").createIndexes([
        { key: { state: 1, visibleAt: 1 } },
        { key: { finishedAt: 1 }, expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { state: "done" } },
      ]),
      d.collection("rateLimits").createIndexes([{ key: { expireAt: 1 }, expireAfterSeconds: 0 }]),
    ]);
    return d;
  })());
}

// Never read back the search copies on list and item queries.
export const LEAN = { projection: { searchBody: 0, searchText: 0, tagNames: 0, listNames: 0 } } as const;

export async function items(): Promise<Collection<ItemDoc>> {
  return (await db()).collection<ItemDoc>("items");
}
export async function lists(): Promise<Collection<ListDoc>> {
  return (await db()).collection<ListDoc>("lists");
}
export async function listRows(): Promise<Collection<ListItemDoc>> {
  return (await db()).collection<ListItemDoc>("listItems");
}
export async function tags(): Promise<Collection<TagDoc>> {
  return (await db()).collection<TagDoc>("tags");
}
export async function highlights(): Promise<Collection<HighlightDoc>> {
  return (await db()).collection<HighlightDoc>("highlights");
}
export async function contents(): Promise<Collection<ContentDoc>> {
  return (await db()).collection<ContentDoc>("contents");
}
export async function jobs(): Promise<Collection<JobDoc>> {
  return (await db()).collection<JobDoc>("jobs");
}
export async function rateLimits(): Promise<Collection<RateLimitDoc>> {
  return (await db()).collection<RateLimitDoc>("rateLimits");
}

// Ids cross the interface as hex strings. A malformed id matches nothing rather than throwing.
export function oid(id: string): ObjectId {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : new ObjectId("000000000000000000000000");
}
