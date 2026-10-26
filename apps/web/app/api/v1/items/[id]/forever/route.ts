import { route } from "@/lib/api";
import { deleteForever } from "@/lib/library";

// Delete forever, from the bin only: the Item, its text, highlights and files go now, not after 30 days.
export const DELETE = route<{ id: string }>({ kind: "write", scope: "library:delete" }, async ({ caller, params }) => {
  await deleteForever(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
