import { z } from "zod";
import { Visibility } from "./enums.ts";
import { Item, ObjectIdString } from "./items.ts";

export const List = z.object({
  id: ObjectIdString,
  name: z.string(),
  slug: z.string(),
  purpose: z.string(),
  visibility: Visibility,
  itemCount: z.number().int(),
  tickedCount: z.number().int(),
  views: z.number().int(),
  lastAddedAt: z.string().nullable(),
  lastActivityAt: z.string(),
  createdBy: z.enum(["user", "mcp"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type List = z.infer<typeof List>;

// One row of a list: the item, and the note and tick that belong to this list.
export const ListEntry = z.object({
  item: Item,
  note: z.string().nullable(),
  noteBy: z.enum(["user", "mcp"]).nullable(),
  ticked: z.boolean(),
  position: z.number(),
  addedAt: z.string(),
});
export type ListEntry = z.infer<typeof ListEntry>;

export const ListMembership = z.object({
  list: List,
  place: z.number().int(), // 1-based
  note: z.string().nullable(),
  noteBy: z.enum(["user", "mcp"]).nullable(),
  ticked: z.boolean(),
});
export type ListMembership = z.infer<typeof ListMembership>;

export const CreateListBody = z.object({
  name: z.string().trim().min(1).max(120),
  purpose: z.string().max(500).optional(),
  items: z.array(z.object({ itemId: ObjectIdString, note: z.string().max(2000).nullable().optional() })).max(200).optional(),
});
export const UpdateListBody = z.object({ name: z.string().trim().min(1).max(120).optional(), purpose: z.string().max(500).optional() }).strict();
export const AddToListBody = z
  .object({
    itemId: ObjectIdString.optional(),
    itemIds: z.array(ObjectIdString).min(1).max(100).optional(),
    position: z.number().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((b) => Boolean(b.itemId) !== Boolean(b.itemIds), { message: "Send itemId or itemIds." });
export const UpdateEntryBody = z
  .object({ note: z.string().max(2000).nullable().optional(), ticked: z.boolean().optional(), position: z.number().optional() })
  .strict();
export const ReorderBody = z.object({ itemIds: z.array(ObjectIdString).max(1000) });

export const ExpiryDays = z.union([z.literal(14), z.literal(30), z.literal(60), z.literal(90), z.null()]);
export const Settings = z.object({
  expiryDays: ExpiryDays,
  expiryScope: z.enum(["inbox_later", "inbox"]),
  digestDay: z.number().int().min(0).max(6).nullable(), // null: no weekly email
  timezone: z.string().min(1).max(64),
});
export type Settings = z.infer<typeof Settings>;

export const Me = z.object({
  id: ObjectIdString,
  email: z.string(),
  name: z.string(),
  handle: z.string().nullable(),
  handleChangeableAt: z.string().nullable(), // when a set handle can change again
  createdAt: z.string(),
  settings: Settings,
});
export type Me = z.infer<typeof Me>;
export const UpdateMeBody = z
  .object({ name: z.string().max(80).optional(), handle: z.string().max(40).optional(), settings: Settings.partial().optional() })
  .strict();
export const ArchiveStaleBody = z.object({ olderThanDays: z.number().int().min(1).max(3650).optional(), dryRun: z.boolean().default(false) });

export const VisibilityBody = z.object({ visibility: Visibility });

// What a public page may show. Pinned by packages/db/src/public.test.ts: no text, tags, ticks or status, ever.
export const PublicEntry = z.object({
  id: ObjectIdString,
  title: z.string(),
  siteName: z.string().nullable(),
  excerpt: z.string().nullable(),
  url: z.string().nullable(),
  hasCover: z.boolean(),
  note: z.string().nullable(),
});
export const PublicList = z.object({
  list: z.object({ id: ObjectIdString, name: z.string(), purpose: z.string(), updatedAt: z.string(), itemCount: z.number().int(), noindex: z.boolean() }),
  author: z.object({ name: z.string().nullable(), handle: z.string() }),
  entries: z.array(PublicEntry),
});
export type PublicList = z.infer<typeof PublicList>;

export const REPORT_REASONS = ["illegal", "minors", "harassment", "doxxing", "spam", "malware", "infringement", "other"] as const;
export const ReportBody = z.object({ listId: ObjectIdString, reason: z.enum(REPORT_REASONS), details: z.string().max(2000).optional() });
export const CopyListBody = z.object({ listId: ObjectIdString });

export const AdminReport = z.object({
  id: ObjectIdString,
  reason: z.string(),
  details: z.string().nullable(),
  createdAt: z.string(),
  list: z.object({ id: ObjectIdString, name: z.string(), slug: z.string(), killed: z.boolean() }).nullable(),
  owner: z.object({ id: ObjectIdString, handle: z.string().nullable(), email: z.string(), closed: z.boolean() }).nullable(),
});
export type AdminReport = z.infer<typeof AdminReport>;

export const Digest = z.object({
  expiryDays: z.number().int().nullable(),
  expiring: z.array(z.object({ id: ObjectIdString, title: z.string(), site: z.string(), movesOn: z.string() })),
  due: z.array(z.object({ id: ObjectIdString, title: z.string(), dueAt: z.string() })),
  oldest: z.array(z.object({ id: ObjectIdString, title: z.string(), site: z.string(), createdAt: z.string() })),
  quietLists: z.array(z.object({ id: ObjectIdString, name: z.string(), tickedCount: z.number().int(), itemCount: z.number().int(), idleDays: z.number().int() })),
});
export type Digest = z.infer<typeof Digest>;
