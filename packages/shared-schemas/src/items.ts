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

export const CreateItemBody = z.object({ url: z.string().min(1).max(4096), ...Optional });
export type CreateItemBody = z.infer<typeof CreateItemBody>;

export const CreateItemResult = z.object({ item: Item, created: z.boolean() });
export type CreateItemResult = z.infer<typeof CreateItemResult>;

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
