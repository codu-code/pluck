import { route } from "@/lib/api";
import { coverLocation } from "@/lib/library";

// Covers live in a private bucket; the owner gets a short-lived signed URL.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => {
  return new Response(null, {
    status: 302,
    headers: { location: await coverLocation(caller.userId, params.id), "cache-control": "private, max-age=300" },
  });
});
