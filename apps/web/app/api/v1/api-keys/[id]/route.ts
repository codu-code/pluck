import { route } from "@/lib/api";
import { revokeKey } from "@/lib/library";

export const DELETE = route<{ id: string }>({ kind: "write", scope: "full" }, async ({ caller, params }) => {
  await revokeKey(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
