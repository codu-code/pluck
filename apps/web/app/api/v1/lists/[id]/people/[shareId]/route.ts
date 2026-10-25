import { route } from "@/lib/api";
import { stopSharing } from "@/lib/library";

export const DELETE = route<{ id: string; shareId: string }>({ kind: "write" }, async ({ caller, params }) => {
  await stopSharing(caller.userId, params.id, params.shareId);
  return new Response(null, { status: 204 });
});
