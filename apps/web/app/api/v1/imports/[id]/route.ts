import { json, route } from "@/lib/api";
import { importStatus } from "@/lib/library";

export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json({ import: await importStatus(caller.userId, params.id) }));
