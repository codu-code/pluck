import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { disconnectAiTool } from "@/lib/library";

// A client id can be a URL (CIMD), so it travels in the body rather than the path.
export const POST = route({ kind: "write", scope: "full" }, async ({ req, caller }) => {
  const { clientId } = await parseBody(req, z.object({ clientId: z.string().min(1).max(2048) }));
  await disconnectAiTool(caller.userId, clientId);
  return json({ ok: true });
});
