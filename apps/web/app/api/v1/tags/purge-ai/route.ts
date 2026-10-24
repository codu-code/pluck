import { PurgeAiBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { purgeAi } from "@/lib/library";

// "Remove everything AI tagged this week".
export const POST = route({ kind: "write" }, async ({ req, caller }) => json(await purgeAi(caller.userId, (await parseBody(req, PurgeAiBody)).days)));
