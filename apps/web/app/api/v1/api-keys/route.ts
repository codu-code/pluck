import { CreateApiKeyBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { keysOf, newKey } from "@/lib/library";

// Keys are managed from the signed-in browser only: a key cannot mint more keys.
export const GET = route({ kind: "read", scope: "full" }, async ({ caller }) => json({ keys: await keysOf(caller.userId) }));

export const POST = route({ kind: "write", scope: "full" }, async ({ req, caller }) => {
  const b = await parseBody(req, CreateApiKeyBody);
  const { key, apiKey } = await newKey(caller.userId, b.name, b.scopes);
  return json({ key, apiKey }, 201); // the only time the key is shown
});
