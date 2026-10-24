import { UpdateMeBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { deleteAccount, me, updateMe } from "@/lib/library";
import { z } from "zod";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ me: await me(caller.userId) }));

export const PATCH = route({ kind: "write" }, async ({ req, caller }) => json({ me: await updateMe(caller.userId, await parseBody(req, UpdateMeBody)) }));

// "Delete everything. No, really." The browser session only, with the email typed back.
export const DELETE = route({ kind: "write", scope: "full" }, async ({ req, caller }) => {
  await deleteAccount(caller.userId, (await parseBody(req, z.object({ confirm: z.string() }))).confirm);
  return new Response(null, { status: 204 });
});
