import { json, route } from "@/lib/api";
import { restoreItem } from "@/lib/library";

// Out of the bin. (Out of the Archive is PATCH { status: "inbox" }.)
export const POST = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => json({ item: await restoreItem(caller.userId, params.id) }));
