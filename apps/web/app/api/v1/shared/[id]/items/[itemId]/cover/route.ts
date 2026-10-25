import { route } from "@/lib/api";
import { sharedCoverLocation } from "@/lib/library";

export const GET = route<{ id: string; itemId: string }>({ kind: "read" }, async ({ caller, params }) =>
  Response.redirect(await sharedCoverLocation(caller.userId, params.id, params.itemId), 302),
);
