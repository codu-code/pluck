import { route } from "@/lib/api";
import { openItem } from "@/lib/library";

// Called by the reader once it is on screen (not on prefetch): opening is a touch.
export const POST = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  await openItem(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
