import { route } from "@/lib/api";
import { assertAdmin, closeReport, me } from "@/lib/library";

export const POST = route<{ id: string }>({ kind: "write", scope: "full" }, async ({ caller, params }) => {
  await assertAdmin((await me(caller.userId)).email);
  await closeReport(params.id);
  return new Response(null, { status: 204 });
});
