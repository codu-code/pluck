import type { Locale } from "@pluck/i18n";
import type { ArchivedReason, ExtractionState, Facts, Kind, Preview, Source, Status } from "@pluck/shared-schemas";
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
  previewGuess?: Preview | null; // what the link looked like when last read; absent on Items read before Previews
  previewOverride?: Preview | null; // Show as article / Show as preview, by the person; kept through re-plucks
  facts?: Facts;
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
  inList?: boolean; // in at least one list: exempt from expiry
  searchText?: string; // excerpt, site, host, author
  searchBody?: string; // the kept text or the note body, capped
  deletedAt: Date | null; // in the bin; purged 30 days later
  purging?: true; // claimed by a purge (purgeDocs in items.ts): its files and rows are going, and it cannot come back
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
  publishedAt?: Date | null; // first made public: the slug is frozen from then on
  killed?: boolean; // taken down by an admin; never served publicly
};

// One person a List is shared with, by the email they sign in with. See only.
export type ListShareDoc = { _id: ObjectId; listId: ObjectId; ownerId: ObjectId; email: string; createdAt: Date };

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

// Better Auth owns the core fields; Pluck adds its own through packages/db.
export type UserDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  createdAt: Date;
  handle?: string | null;
  handleChangedAt?: Date | null;
  publicKilled?: boolean; // an admin closed this person's public pages
  settings?: Partial<UserSettings>;
  expiryRanOn?: string; // local date of the last nightly expiry, the claim that makes it run once a day
  digestSentOn?: string; // local date of the last Monday digest
  lastMcpCallAt?: Date; // the connector's last call, for Settings, written at most once a minute
};

export type UserSettings = {
  expiryDays: 14 | 30 | 60 | 90 | null; // null: never
  expiryScope: "inbox_later" | "inbox";
  digestDay: number | null; // 0 Sunday … 6 Saturday; 1 (Monday) by default; null: no email
  timezone: string; // IANA
  locale: Locale | null; // null: follow the browser or phone; set from the sign-up request
};
export const DEFAULT_SETTINGS: UserSettings = { expiryDays: 30, expiryScope: "inbox_later", digestDay: 1, timezone: "UTC", locale: null };

export type ReportDoc = {
  _id: ObjectId;
  listId: ObjectId;
  reporterIp: string; // a salted hash, never the address itself
  reason: string;
  details: string | null;
  createdAt: Date;
  state: "open" | "resolved";
};

export type ApiKeyDoc = { _id: ObjectId; userId: ObjectId; name: string; hash: string; prefix: string; scopes: string[]; lastUsedAt: Date | null; createdAt: Date };

export type ImportDoc = {
  _id: ObjectId;
  userId: ObjectId;
  source: "pocket" | "omnivore" | "raindrop" | "html";
  blobKey: string;
  total: number;
  done: number;
  failed: number;
  state: "waiting" | "running" | "done" | "failed";
  error: string | null;
  createdAt: Date;
};

export type ExportDoc = { _id: ObjectId; userId: ObjectId; state: "running" | "done" | "failed"; blobKey: string | null; createdAt: Date };

export type EmailAliasDoc = { _id: ObjectId; userId: ObjectId; token: string; active: boolean; createdAt: Date };

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

const RETIRED_ITEM_INDEXES = [
  "search",
  "userId_1_status_1_createdAt_-1",
  "userId_1_status_1_lastTouchedAt_1",
  "userId_1_tagIds_1_createdAt_-1",
  "userId_1_status_1_statusChangedAt_-1",
];

// Indexes are created once per process, before the first query.
export function db(): Promise<Db> {
  return (ready ??= (async () => {
    const d = getDb();
    const itemsCol = d.collection("items");
    await Promise.all([
      // The retired indexes go first: a collection holds one text index, and the rest are prefixes of their successors.
      // Remove this line once every database has started on the new ones.
      Promise.all(RETIRED_ITEM_INDEXES.map((name) => itemsCol.dropIndex(name).catch(() => undefined))).then(() =>
        itemsCol.createIndexes([
          // Every listing sorts on (field, _id), so the index ends in _id too; otherwise each page sorts in memory.
          { key: { userId: 1, status: 1, createdAt: -1, _id: -1 } },
          { key: { userId: 1, status: 1, lastTouchedAt: 1, _id: 1 } },
          { key: { userId: 1, urlHash: 1 }, unique: true, partialFilterExpression: { urlHash: { $type: "string" } } },
          { key: { userId: 1, tagIds: 1, createdAt: -1, _id: -1 } },
          { key: { userId: 1, kind: 1, dueAt: 1 } },
          { key: { "extraction.state": 1, updatedAt: 1 } },
          { key: { userId: 1, status: 1, statusChangedAt: -1, _id: -1 } },
          { key: { userId: 1, deletedAt: -1, _id: -1 } }, // the Bin
          { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: { $type: "date" } } },
          {
            // userId first: a search reads one person's matches, not everyone's. Every $text query filters on it.
            key: { userId: 1, title: "text", note: "text", tagNames: "text", listNames: "text", searchText: "text", searchBody: "text" },
            name: "search_by_user",
            weights: { title: 10, note: 5, tagNames: 5, listNames: 3, searchText: 2, searchBody: 1 },
            default_language: "english",
            language_override: "searchLanguage", // items carry `lang` for display; never let it switch stemming
          },
        ]),
      ),
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
      d.collection("users").createIndexes([{ key: { handle: 1 }, unique: true, partialFilterExpression: { handle: { $type: "string" } } }]),
      d.collection("listShares").createIndexes([{ key: { listId: 1, email: 1 }, unique: true }, { key: { email: 1, createdAt: -1 } }, { key: { ownerId: 1 } }]),
      d.collection("apiKeys").createIndexes([{ key: { hash: 1 }, unique: true }, { key: { userId: 1 } }]),
      d.collection("imports").createIndexes([{ key: { userId: 1, createdAt: -1 } }]),
      d.collection("exports").createIndexes([{ key: { userId: 1, createdAt: -1 } }]),
      d.collection("emailAliases").createIndexes([{ key: { token: 1 }, unique: true }, { key: { userId: 1, active: 1 } }]),
      d.collection("meta").createIndexes([{ key: { at: 1 }, expireAfterSeconds: 7 * 86_400 }]),
      d.collection("reports").createIndexes([{ key: { state: 1, createdAt: -1 } }]),
      d.collection("tags").createIndexes([{ key: { userId: 1, slug: 1 }, unique: true }]),
      d.collection("highlights").createIndexes([{ key: { userId: 1, itemId: 1, createdAt: 1 } }]),
      d.collection("contents").createIndexes([{ key: { itemId: 1 }, unique: true }]),
      d.collection("jobs").createIndexes([
        { key: { state: 1, visibleAt: 1 } },
        { key: { finishedAt: 1 }, expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { state: "done" } },
      ]),
      d.collection("rateLimits").createIndexes([{ key: { expireAt: 1 }, expireAfterSeconds: 0 }]),
      d.collection("tries").createIndexes([{ key: { expireAt: 1 }, expireAfterSeconds: 0 }]),
    ]);
    return d;
  })());
}

// Never read back the search copies on list and item queries.
export const LEAN = { projection: { searchBody: 0, searchText: 0, tagNames: 0, listNames: 0 } } as const; // inList stays: the UI needs it

export async function items(): Promise<Collection<ItemDoc>> {
  return (await db()).collection<ItemDoc>("items");
}
export async function apiKeys(): Promise<Collection<ApiKeyDoc>> {
  return (await db()).collection<ApiKeyDoc>("apiKeys");
}
export async function imports(): Promise<Collection<ImportDoc>> {
  return (await db()).collection<ImportDoc>("imports");
}
export async function exportsCol(): Promise<Collection<ExportDoc>> {
  return (await db()).collection<ExportDoc>("exports");
}
export async function emailAliases(): Promise<Collection<EmailAliasDoc>> {
  return (await db()).collection<EmailAliasDoc>("emailAliases");
}
// One-off claims (claimOnce) and the place a long-running pass (the Preview backfill) keeps its cursor.
export type MetaDoc = { _id: string; at: Date; after?: ObjectId; done?: boolean };
export async function meta(): Promise<Collection<MetaDoc>> {
  return (await db()).collection<MetaDoc>("meta");
}
export async function users(): Promise<Collection<UserDoc>> {
  return (await db()).collection<UserDoc>("users");
}
export async function reports(): Promise<Collection<ReportDoc>> {
  return (await db()).collection<ReportDoc>("reports");
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
export async function listShares(): Promise<Collection<ListShareDoc>> {
  return (await db()).collection<ListShareDoc>("listShares");
}
export async function rateLimits(): Promise<Collection<RateLimitDoc>> {
  return (await db()).collection<RateLimitDoc>("rateLimits");
}

// Ids cross the interface as hex strings. A malformed id matches nothing rather than throwing.
export function oid(id: string): ObjectId {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : new ObjectId("000000000000000000000000");
}
