import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { storeRoot } from "../../data";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

// The store assets for the dev preview, straight from docs/store. Never in production: the files aren't deployed.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response("not found", { status: 404 });
  const root = storeRoot();
  const path = normalize(join(root, ...(await params).path));
  if (!path.startsWith(root) || !TYPES[extname(path)]) return new Response("not found", { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(path)), { headers: { "content-type": TYPES[extname(path)]!, "cache-control": "no-store" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
