import { UpdateListBody, Visibility } from "@pluck/shared-schemas";
import { z } from "zod";
import { ApiError, hasScope, json, parseBody, route } from "@/lib/api";
import { editList, readList, removeList, setListVisibility } from "@/lib/library";

export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json(await readList(caller.userId, params.id)));

const Patch = UpdateListBody.extend({ visibility: Visibility.optional() });

// Name, purpose and visibility. Public needs a handle (409 handle_required), and the person: their browser or one of
// our own apps (the account scope), never an API key or an AI tool's token. Making a List private is a plain write.
export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const { visibility, ...rest } = await parseBody(req, Patch as z.ZodType<z.infer<typeof Patch>>);
  if (visibility === "public" && !hasScope(caller, "account"))
    throw new ApiError("forbidden", "Only the person can make a list public, from the list in Pluck.", 403, { needs: "account" });
  let list = Object.keys(rest).length ? await editList(caller.userId, params.id, rest) : null;
  if (visibility) list = await setListVisibility(caller.userId, params.id, visibility);
  return json({ list: list ?? (await readList(caller.userId, params.id)).list });
});

// The list goes; its items stay in the library.
export const DELETE = route<{ id: string }>({ kind: "write", scope: "library:delete" }, async ({ caller, params }) => {
  await removeList(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
