import { json, route } from "@/lib/api";
import { fileLocation } from "@/lib/library";

// A PDF's kept file, as a short-lived signed URL (JSON, so the download needs no Authorization header).
export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json({ url: await fileLocation(caller.userId, params.id) }));
