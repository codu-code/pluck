// Runs once as each server starts. The secrets in .env.example are public: a copy reachable from elsewhere would let
// anyone sign sessions or run the cron, so it refuses to start with them. One machine may (the e2e server, a self-host
// on localhost), as with the blob store's default in docker/entrypoint.sh, and so may `next build`, whose placeholder
// secret never serves a request.
export function register() {
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return;
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret === "dev-only-secret-change-me-in-production-0123456789" || secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET is the example one or shorter than 32 characters: set 32+ random bytes (openssl rand -base64 32).");
  if (process.env.CRON_SECRET === "dev-cron-secret") throw new Error("CRON_SECRET is the example one: set a random value (openssl rand -hex 32).");
}

// Errors thrown while rendering a page or running a route that did not catch them (route handlers in lib/api.ts
// catch and log their own).
export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./lib/log");
  log("error", "request error", { path: request.path.split("?")[0], method: request.method, error });
}
