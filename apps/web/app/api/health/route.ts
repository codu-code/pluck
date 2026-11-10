import { ping } from "@pluck/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ ok: await ping() });
  } catch (error) {
    // Why the container is unhealthy, in `docker compose logs web`. The driver's errors name the host, never the password.
    log("error", "health check failed", { error });
    return Response.json({ ok: false }, { status: 503 });
  }
}
