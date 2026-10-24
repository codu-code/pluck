import { ping } from "@pluck/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ ok: await ping() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
