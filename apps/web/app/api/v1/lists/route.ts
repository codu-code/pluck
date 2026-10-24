import { CreateListBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { listsOf, newList } from "@/lib/library";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ lists: await listsOf(caller.userId) }));

export const POST = route({ kind: "write" }, async ({ req, caller }) =>
  json({ list: await newList(caller.userId, await parseBody(req, CreateListBody)) }, 201),
);
