import { z } from "zod";
import { ArchivedReason, ExtractionState, Kind, Source, Status } from "./enums.ts";
import { Facts, Preview } from "./preview.ts";

export const ObjectIdString = z.string().regex(/^[a-f0-9]{24}$/, "not an id");

export const Item = z.object({
  id: ObjectIdString,
  kind: Kind,
  url: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  title: z.string(),
  titleIsDerived: z.boolean(),
  siteName: z.string().nullable(),
  author: z.string().nullable(),
  excerpt: z.string().nullable(),
  hasCover: z.boolean(),
  preview: Preview.nullable(), // the screen it opens on: your choice, else what the link looked like; null for Images and text Kinds
  previewGuess: Preview.nullable(), // what the link looked like, so "Show as preview" can go back to it
  facts: Facts,
  status: Status,
  archivedReason: ArchivedReason.nullable(),
  dueAt: z.string().nullable(),
  tagIds: z.array(ObjectIdString),
  aiTagIds: z.array(ObjectIdString), // the subset an AI tool added, shown "by AI" until the person touches them
  note: z.string().nullable(),
  source: Source,
  wordCount: z.number().int().nullable(),
  lang: z.string().nullable(),
  extraction: z.object({ state: ExtractionState, attempts: z.number().int(), lastError: z.string().nullable() }),
  readingProgress: z.number().min(0).max(1),
  inList: z.boolean(), // in at least one list: never expires
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTouchedAt: z.string(),
  statusChangedAt: z.string(),
  deletedAt: z.string().nullable(), // in the bin since
});
export type Item = z.infer<typeof Item>;

const Optional = {
  html: z.string().max(5_000_000).optional(),
  title: z.string().max(500).optional(),
  note: z.string().max(10_000).optional(),
  selection: z.string().max(20_000).optional(), // kept as a highlight on the item (the extension's "Pluck selection")
  transcript: z.string().max(500_000).optional(), // a video's captions, read in the browser; kept with the page text
  source: Source.optional(),
};

export const DueAt = z.iso.datetime({ offset: true });

export const BIN_DAYS = 30; // deleted items wait this long in the Bin, then go for good

// One of: { url }, { urls[] } (max 50), or { text }. Text with no kind becomes one link item per URL
// found in it, or a Note when it has none. Text with kind note, todo or thing becomes that kind.
export const CreateItemBody = z
  .object({
    url: z.string().min(1).max(4096).optional(),
    urls: z.array(z.string().min(1).max(4096)).min(1).max(50).optional(),
    text: z.string().min(1).max(100_000).optional(),
    kind: Kind.optional(),
    dueAt: DueAt.optional(),
    ...Optional,
  })
  .refine((b) => [b.url, b.urls, b.text].filter((v) => v !== undefined).length === 1, {
    message: "Send exactly one of url, urls or text.",
  });
export type CreateItemBody = z.infer<typeof CreateItemBody>;

export const CreateItemResult = z.object({ item: Item, created: z.boolean() });
export type CreateItemResult = z.infer<typeof CreateItemResult>;

export const PluckResponse = z.object({
  results: z.array(CreateItemResult),
  rejected: z.array(z.object({ input: z.string(), message: z.string() })),
});
export type PluckResponse = z.infer<typeof PluckResponse>;

export const UpdateItemBody = z
  .object({
    title: z.string().max(500).optional(), // "" goes back to the derived title
    text: z.string().max(100_000).optional(), // notes, todos and things only
    kind: Kind.optional(),
    dueAt: DueAt.nullable().optional(),
    status: Status.optional(), // done is for todos and things
    note: z.string().max(10_000).nullable().optional(),
    readingProgress: z.number().min(0).max(1).optional(),
    preview: Preview.nullable().optional(), // Show as article (reader) or as its preview; null goes back to the guess
    tagIds: z.array(z.string().min(1).max(64)).max(50).optional(), // ids, or existing tag names
  })
  .strict();
export type UpdateItemBody = z.infer<typeof UpdateItemBody>;

// One change over many items: bulk select in the apps, batch_update for an AI tool.
const TagRefs = z.array(z.string().min(1).max(64)).max(50);
export const BatchPatch = z
  .object({
    status: Status.optional(), kind: Kind.optional(), dueAt: DueAt.nullable().optional(), note: z.string().max(10_000).nullable().optional(),
    addTagIds: TagRefs.optional(), removeTagIds: TagRefs.optional(),
  })
  .strict()
  .refine((p) => Object.keys(p).length > 0, { message: "Send at least one change." });
export const BatchBody = z.object({ itemIds: z.array(ObjectIdString).min(1).max(100), patch: BatchPatch });
export type BatchBody = z.infer<typeof BatchBody>;

export const Highlight = z.object({
  id: ObjectIdString,
  itemId: ObjectIdString,
  quote: z.string(),
  note: z.string().nullable(),
  selector: z.object({
    textQuote: z.object({ exact: z.string(), prefix: z.string(), suffix: z.string() }),
    textPosition: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }),
  }),
  createdAt: z.string(),
});
export type Highlight = z.infer<typeof Highlight>;
export const CreateHighlightBody = z.object({
  itemId: ObjectIdString,
  quote: z.string().min(1).max(5000),
  note: z.string().max(5000).nullable().optional(),
  selector: Highlight.shape.selector,
});
export type CreateHighlightBody = z.infer<typeof CreateHighlightBody>;
export const UpdateHighlightBody = z.object({ note: z.string().max(5000).nullable() }).strict();

// "archive" is the Archive page: archived and done together, newest move first.
export const ListView = z.union([Status, z.literal("archive"), z.literal("bin")]);
export type ListView = z.infer<typeof ListView>;
export const ArchiveFilter = z.enum(["all", "you", "expired", "import"]);
export type ArchiveFilter = z.infer<typeof ArchiveFilter>;

export const ListItemsQuery = z.object({
  status: ListView.default("inbox"),
  archive: ArchiveFilter.optional(),
  tagId: ObjectIdString.optional(),
  kinds: z.array(Kind).optional(),
  sort: z.enum(["newest", "untouched"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export type ListItemsQuery = z.infer<typeof ListItemsQuery>;

export const ItemPage = z.object({ items: z.array(Item), nextCursor: z.string().nullable() });
export type ItemPage = z.infer<typeof ItemPage>;

export const Tag = z.object({
  id: ObjectIdString,
  name: z.string(),
  slug: z.string(),
  colour: z.string(),
  count: z.number().int(),
  aiCount: z.number().int(), // assignments still marked "by AI"
  createdBy: z.enum(["user", "mcp"]),
  createdAt: z.string(),
});
export type Tag = z.infer<typeof Tag>;
export const CreateTagBody = z.object({ name: z.string().trim().min(1).max(40) });
export const UpdateTagBody = z.object({ name: z.string().trim().min(1).max(40) }).strict();
export const DeleteTagQuery = z.union([
  z.object({ reassignTo: ObjectIdString }),
  z.object({ removeFromItems: z.literal("true") }),
]);
export const PurgeAiBody = z.object({ days: z.number().int().min(1).max(90).default(7) });

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(500),
  kinds: z.array(Kind).optional(),
  tagIds: z.array(ObjectIdString).max(10).optional(),
  listId: ObjectIdString.optional(),
  status: Status.optional(), // omitted: everything but the bin, Archive included
  since: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().optional(),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchHit = z.object({
  item: Item,
  snippet: z.object({ source: z.enum(["note", "body", "excerpt"]), pre: z.string(), hit: z.string(), post: z.string() }).nullable(),
});
export type SearchHit = z.infer<typeof SearchHit>;
export const SearchResults = z.object({ results: z.array(SearchHit), total: z.number().int(), nextCursor: z.string().nullable() });
export type SearchResults = z.infer<typeof SearchResults>;

// A file shared from the phone (the share extension): the client uploads it to the returned URL.
export const FILE_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp", "image/gif": "gif" } as const;
export const MAX_FILE_BYTES = 50_000_000; // also the most the worker will read back
export const CreateFileItemBody = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.enum(Object.keys(FILE_TYPES) as [keyof typeof FILE_TYPES, ...(keyof typeof FILE_TYPES)[]]),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  source: Source.optional(),
});
export type CreateFileItemBody = z.infer<typeof CreateFileItemBody>;
