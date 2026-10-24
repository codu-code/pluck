import { CopyListBody } from "@pluck/shared-schemas";
import { after } from "next/server";
import { json, parseBody, route } from "@/lib/api";
import { copyList } from "@/lib/library";

// "Pluck this list". Limited to 20 a day per person.
export const POST = route({ kind: "write", ipLimit: true }, async ({ req, caller }) =>
  json({ list: await copyList(caller.userId, (await parseBody(req, CopyListBody)).listId, { defer: after }) }, 201),
);
