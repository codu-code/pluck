import { route } from "@/lib/api";
import { assertAdmin, me, takeDownList } from "@/lib/library";

// The per-list kill switch.
export const POST = route<{ id: string }>({ kind: "write", scope: "full" }, async ({ caller, params }) => {
  await assertAdmin((await me(caller.userId)).email);
  await takeDownList(params.id);
  return new Response(null, { status: 204 });
});
