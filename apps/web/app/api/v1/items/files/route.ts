import { CreateFileItemBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { beginFile } from "@/lib/library";

// An Image or PDF shared as a file: the item now, and a URL to PUT the bytes to (they can be large).
export const POST = route({ kind: "write", ipLimit: true }, async ({ req, caller }) => {
  return json(await beginFile(caller.userId, await parseBody(req, CreateFileItemBody)), 201);
});
