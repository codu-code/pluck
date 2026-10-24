// Errors thrown while rendering a page or running a route that did not catch them (route handlers in lib/api.ts
// catch and log their own).
export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./lib/log");
  log("error", "request error", { path: request.path.split("?")[0], method: request.method, error });
}
