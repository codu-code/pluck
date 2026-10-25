import { ApiError, json, route } from "@/lib/api";
import { coverLocation, setCoverFromApp } from "@/lib/library";

// Covers live in a private bucket; the owner gets a short-lived signed URL. `?as=json` hands it over instead of
// redirecting, for a download that must not carry the Authorization header on to the bucket (the iPhone's).
export const GET = route<{ id: string }>({ kind: "read" }, async ({ req, caller, params }) => {
  const location = await coverLocation(caller.userId, params.id);
  if (new URL(req.url).searchParams.get("as") === "json") return json({ url: location });
  return new Response(null, { status: 302, headers: { location, "cache-control": "private, max-age=300" } });
});

const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_COVER = 2_000_000;

// The extension sends a screenshot of the tab when the page has no image of its own.
export const PUT = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const type = req.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!COVER_TYPES.has(type)) throw new ApiError("bad_request", "Send a JPEG, PNG or WebP image.", 400);
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > MAX_COVER) throw new ApiError("bad_request", "That image is over 2 MB.", 400);
  return json({ item: await setCoverFromApp(caller.userId, params.id, body, type) });
});
