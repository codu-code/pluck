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
