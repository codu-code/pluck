import { SearchQuery } from "@pluck/shared-schemas";
import { json, route, searchParamsObject } from "@/lib/api";
import { search } from "@/lib/library";

export const GET = route({ kind: "read" }, async ({ req, caller }) => json(await search(caller.userId, SearchQuery.parse(searchParamsObject(req)))));
