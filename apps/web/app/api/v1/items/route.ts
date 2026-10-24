import { CreateItemBody, ListItemsQuery } from "@pluck/shared-schemas";
import { after } from "next/server";
import { json, parseBody, route, searchParamsObject } from "@/lib/api";
import { browse, pluck } from "@/lib/library";

export const POST = route({ kind: "write", ipLimit: true }, async ({ req, caller }) => {
  const body = await parseBody(req, CreateItemBody);
  const result = await pluck(caller.userId, body, { defer: after });
  return json(result, result.created ? 201 : 200);
});

export const GET = route({ kind: "read", ipLimit: true }, async ({ req, caller }) => {
  return json(await browse(caller.userId, ListItemsQuery.parse(searchParamsObject(req))));
});
