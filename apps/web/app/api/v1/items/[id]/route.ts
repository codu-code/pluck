import { UpdateItemBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { readItem, readText, updateItem } from "@/lib/library";

export const GET = route<{ id: string }>({ kind: "read" }, async ({ req, caller, params }) => {
  const item = await readItem(caller.userId, params.id);
  const include = new URL(req.url).searchParams.get("include")?.split(",") ?? [];
  const text = include.includes("text") ? await readText(caller.userId, item.id) : undefined;
  return json({ item, ...(text === undefined ? {} : { text }) });
});

export const PATCH = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  return json({ item: await updateItem(caller.userId, params.id, await parseBody(req, UpdateItemBody)) });
});
