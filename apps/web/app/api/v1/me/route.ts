import { UpdateMeBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { me, updateMe } from "@/lib/library";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ me: await me(caller.userId) }));

export const PATCH = route({ kind: "write" }, async ({ req, caller }) => json({ me: await updateMe(caller.userId, await parseBody(req, UpdateMeBody)) }));
