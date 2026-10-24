import { AddToListBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { addItems } from "@/lib/library";

export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const b = await parseBody(req, AddToListBody);
  return json(await addItems(caller.userId, params.id, b.itemIds ?? [b.itemId!], { note: b.note, position: b.position }));
});
