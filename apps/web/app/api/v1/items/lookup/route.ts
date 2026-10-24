import { z } from "zod";
import { json, route } from "@/lib/api";
import { lookup } from "@/lib/library";

// Is this URL already plucked? The extension asks for its badge and its popup.
export const GET = route({ kind: "read" }, async ({ req, caller }) => {
  const url = z.string().min(1).max(4096).parse(new URL(req.url).searchParams.get("url"));
  return json({ item: await lookup(caller.userId, url) });
});
