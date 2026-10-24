import { DeleteTagQuery, UpdateTagBody } from "@pluck/shared-schemas";
import { json, parseBody, route, searchParamsObject } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { removeTag, renameTagFor } from "@/lib/library";

export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) =>
  json({ tag: await renameTagFor(caller.userId, params.id, (await parseBody(req, UpdateTagBody)).name) }),
);

// DELETE needs ?reassignTo=<tagId> (merge) or ?removeFromItems=true.
export const DELETE = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const q = DeleteTagQuery.safeParse(searchParamsObject(req));
  if (!q.success) throw new ApiError("bad_request", "Say where its items go: reassignTo=<tag id>, or removeFromItems=true.", 400);
  await removeTag(caller.userId, params.id, "reassignTo" in q.data ? { reassignTo: q.data.reassignTo } : { removeFromItems: true });
  return new Response(null, { status: 204 });
});
