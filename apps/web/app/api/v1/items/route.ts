import { CreateItemBody, ListItemsQuery } from "@pluck/shared-schemas";
import { after } from "next/server";
import { json, parseBody, route, searchParamsObject } from "@/lib/api";
import { browse, pluckAny } from "@/lib/library";

export const POST = route({ kind: "write", ipLimit: true }, async ({ req, caller }) => {
  const body = await parseBody(req, CreateItemBody);
  const result = await pluckAny(caller.userId, body, { defer: after });
  const status = result.results.some((r) => r.created) ? 201 : result.results.length ? 200 : 400;
  return json(result, status);
});

export const GET = route({ kind: "read", ipLimit: true }, async ({ req, caller }) => {
  return json(await browse(caller.userId, ListItemsQuery.parse(searchParamsObject(req))));
});
