import { ReorderBody } from "@pluck/shared-schemas";
import { parseBody, route } from "@/lib/api";
import { reorder } from "@/lib/library";

export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  await reorder(caller.userId, params.id, (await parseBody(req, ReorderBody)).itemIds);
  return new Response(null, { status: 204 });
});
