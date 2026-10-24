import { UpdateItemBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { deleteItem, highlightsOf, readItem, readText, updateItem } from "@/lib/library";

export const GET = route<{ id: string }>({ kind: "read" }, async ({ req, caller, params }) => {
  const item = await readItem(caller.userId, params.id);
  const include = new URL(req.url).searchParams.get("include")?.split(",") ?? [];
  return json({
    item,
    ...(include.includes("text") ? { text: await readText(caller.userId, item.id) } : {}),
    ...(include.includes("highlights") ? { highlights: await highlightsOf(caller.userId, item.id) } : {}),
  });
});

export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  return json({ item: await updateItem(caller.userId, params.id, await parseBody(req, UpdateItemBody)) });
});

// Soft delete: the item waits in the bin for 30 days. Web and iOS only; MCP never deletes.
export const DELETE = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  await deleteItem(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
