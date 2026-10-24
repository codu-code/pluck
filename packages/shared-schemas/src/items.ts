import { z } from "zod";
import { ArchivedReason, ExtractionState, Kind, Source, Status } from "./enums.ts";

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
  status: Status,
  archivedReason: ArchivedReason.nullable(),
  dueAt: z.string().nullable(),
  tagIds: z.array(ObjectIdString),
  note: z.string().nullable(),
  source: Source,
  wordCount: z.number().int().nullable(),
  lang: z.string().nullable(),
  extraction: z.object({ state: ExtractionState, attempts: z.number().int(), lastError: z.string().nullable() }),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTouchedAt: z.string(),
});
export type Item = z.infer<typeof Item>;

const Optional = {
  html: z.string().max(5_000_000).optional(),
  title: z.string().max(500).optional(),
  note: z.string().max(10_000).optional(),
  selection: z.string().max(20_000).optional(),
  source: Source.optional(),
};

export const DueAt = z.iso.datetime({ offset: true });

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

// Grows slice by slice (status, tags, note and progress land with triage and tags).
export const UpdateItemBody = z
  .object({
    title: z.string().max(500).optional(), // "" goes back to the derived title
    text: z.string().max(100_000).optional(), // notes, todos and things only
    kind: Kind.optional(),
    dueAt: DueAt.nullable().optional(),
  })
  .strict();
export type UpdateItemBody = z.infer<typeof UpdateItemBody>;

export const ListItemsQuery = z.object({
  status: Status.default("inbox"),
  kinds: z.array(Kind).optional(),
  sort: z.enum(["newest", "untouched"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export type ListItemsQuery = z.infer<typeof ListItemsQuery>;

export const ItemPage = z.object({ items: z.array(Item), nextCursor: z.string().nullable() });
export type ItemPage = z.infer<typeof ItemPage>;
