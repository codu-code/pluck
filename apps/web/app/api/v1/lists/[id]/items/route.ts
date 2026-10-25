import { AddToListBody, MarkEntriesBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { addItems, markMany } from "@/lib/library";

export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const b = await parseBody(req, AddToListBody);
  return json(await addItems(caller.userId, params.id, b.itemIds ?? [b.itemId!], { note: b.note, position: b.position }));
});

// Bulk select: mark or unmark many rows. The marks are the owner's alone.
export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const b = await parseBody(req, MarkEntriesBody);
  return json(await markMany(caller.userId, params.id, b.itemIds, b.ticked));
});
