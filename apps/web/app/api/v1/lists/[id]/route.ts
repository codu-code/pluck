import { UpdateListBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { editList, readList, removeList } from "@/lib/library";

export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json(await readList(caller.userId, params.id)));

export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) =>
  json({ list: await editList(caller.userId, params.id, await parseBody(req, UpdateListBody)) }),
);

// The list goes; its items stay in the library.
export const DELETE = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  await removeList(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
