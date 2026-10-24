import { UpdateEntryBody } from "@pluck/shared-schemas";
import { parseBody, route } from "@/lib/api";
import { editEntry, removeItem } from "@/lib/library";

// The note, tick and position that belong to this item in this list.
export const PATCH = route<{ id: string; itemId: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  await editEntry(caller.userId, params.id, params.itemId, await parseBody(req, UpdateEntryBody));
  return new Response(null, { status: 204 });
});

export const DELETE = route<{ id: string; itemId: string }>({ kind: "write" }, async ({ caller, params }) => {
  await removeItem(caller.userId, params.id, params.itemId);
  return new Response(null, { status: 204 });
});
