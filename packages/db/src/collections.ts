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
  deletedAt: Date | null; // in the bin; purged 30 days later
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
      ]),
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

export async function items(): Promise<Collection<ItemDoc>> {
  return (await db()).collection<ItemDoc>("items");
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
