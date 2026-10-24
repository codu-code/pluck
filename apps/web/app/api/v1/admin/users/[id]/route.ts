import { route } from "@/lib/api";
import { assertAdmin, closeAccountPages, me } from "@/lib/library";

// The per-user kill switch: every public page of theirs goes, and they cannot publish again.
export const POST = route<{ id: string }>({ kind: "write", scope: "full" }, async ({ caller, params }) => {
  await assertAdmin((await me(caller.userId)).email);
  await closeAccountPages(params.id);
  return new Response(null, { status: 204 });
});
