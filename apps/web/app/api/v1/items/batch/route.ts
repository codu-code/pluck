import { BatchBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { batch } from "@/lib/library";

export const POST = route({ kind: "write" }, async ({ req, caller }) => json(await batch(caller.userId, await parseBody(req, BatchBody))));
