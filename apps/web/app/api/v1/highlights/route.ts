import { CreateHighlightBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { addHighlight } from "@/lib/library";

export const POST = route({ kind: "write" }, async ({ req, caller }) =>
  json({ highlight: await addHighlight(caller.userId, await parseBody(req, CreateHighlightBody)) }, 201),
);
