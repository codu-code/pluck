import { UpdateMeBody } from "@pluck/shared-schemas";
import { ApiError, hasScope, json, parseBody, route } from "@/lib/api";
import { deleteAccount, me, updateMe } from "@/lib/library";
import { z } from "zod";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ me: await me(caller.userId) }));

// Name and settings are a plain write. The handle is the address of every public List, so changing it takes the person:
// their browser or one of our own apps (the account scope), never an API key or an AI tool's token.
export const PATCH = route({ kind: "write" }, async ({ req, caller }) => {
  const body = await parseBody(req, UpdateMeBody);
  if (body.handle !== undefined && !hasScope(caller, "account")) throw new ApiError("forbidden", "This key cannot do that.", 403, { needs: "account" });
  return json({ me: await updateMe(caller.userId, body) });
});

// "Delete everything. No, really." The browser session only, with the email typed back.
export const DELETE = route({ kind: "write", scope: "account" }, async ({ req, caller }) => {
  await deleteAccount(caller.userId, (await parseBody(req, z.object({ confirm: z.string() }))).confirm);
  return new Response(null, { status: 204 });
});
