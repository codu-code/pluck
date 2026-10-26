import { UpdateHighlightBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { noteHighlight, removeHighlight } from "@/lib/library";

export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) =>
  json({ highlight: await noteHighlight(caller.userId, params.id, (await parseBody(req, UpdateHighlightBody)).note) }),
);

export const DELETE = route<{ id: string }>({ kind: "write", scope: "library:delete" }, async ({ caller, params }) => {
  await removeHighlight(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
