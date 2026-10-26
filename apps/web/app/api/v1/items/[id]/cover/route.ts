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
const tooBig = () => new ApiError("bad_request", "That image is over 2 MB.", 400);

// Stops reading at the limit: content-length can be missing or wrong.
async function readUpTo(req: Request, max: number): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    if ((size += value.byteLength) > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// The extension sends a screenshot of the tab when the page has no image of its own.
export const PUT = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const type = req.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!COVER_TYPES.has(type)) throw new ApiError("bad_request", "Send a JPEG, PNG or WebP image.", 400);
  if (Number(req.headers.get("content-length")) > MAX_COVER) throw tooBig();
  const body = await readUpTo(req, MAX_COVER);
  if (!body) throw tooBig();
  return json({ item: await setCoverFromApp(caller.userId, params.id, body, type) });
});
