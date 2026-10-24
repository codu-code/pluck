import { hitRateLimit } from "@pluck/db";
import { ZodError, type ZodType } from "zod";
import { auth } from "./auth";
import { ApiError } from "./errors";
import { log } from "./log";

export { ApiError };

export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

const errorResponse = (e: ApiError, headers?: HeadersInit) =>
  json({ error: { code: e.code, message: e.message, ...(e.details === undefined ? {} : { details: e.details }) } }, e.status, headers);

export type Caller = { userId: string; scopes: string[] };

// Every API request resolves to a caller here. Session cookie today; OAuth and API keys join in later slices.
export async function authenticate(req: Request): Promise<Caller | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session ? { userId: session.user.id, scopes: ["full"] } : null;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("bad_request", "The body is not valid JSON.", 400);
  }
  return schema.parse(raw);
}

export const searchParamsObject = (req: Request) => {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of new URL(req.url).searchParams) {
    const key = k.endsWith("[]") ? k.slice(0, -2) : k;
    if (k.endsWith("[]") || key === "kinds" || key === "tagIds") out[key] = [...((out[key] as string[]) ?? []), ...v.split(",")];
    else out[key] = v;
  }
  return out;
};

type Options = { kind: "read" | "write"; ipLimit?: boolean };
type Handler<P> = (ctx: { req: Request; caller: Caller; params: P }) => Promise<Response>;

// Spec limits: per user 120 writes and 600 reads a minute; per IP 300 a minute on the abuse-prone routes.
const LIMITS = { read: 600, write: 120, ip: 300 };

async function limited(key: string, max: number): Promise<ApiError | null> {
  const r = await hitRateLimit(key, max, 60);
  return r.ok ? null : new ApiError("rate_limited", "Too many requests. Try again shortly.", 429, { retryAfter: r.retryAfter });
}

export function route<P = Record<string, never>>(opts: Options, handler: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const started = Date.now();
    let caller: Caller | null = null;
    try {
      if (opts.ipLimit) {
        const hit = await limited(`ip:${clientIp(req)}`, LIMITS.ip);
        if (hit) return errorResponse(hit, { "retry-after": String((hit.details as { retryAfter: number }).retryAfter) });
      }
      caller = await authenticate(req);
      if (!caller) throw new ApiError("unauthorized", "Sign in to continue.", 401);
      const hit = await limited(`user:${caller.userId}:${opts.kind}`, LIMITS[opts.kind]);
      if (hit) return errorResponse(hit, { "retry-after": String((hit.details as { retryAfter: number }).retryAfter) });
      return await handler({ req, caller, params: await ctx.params });
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e);
      if (e instanceof ZodError) return errorResponse(new ApiError("bad_request", "Some fields are not right.", 400, e.issues));
      log("error", "api error", { userId: caller?.userId, path: new URL(req.url).pathname, durationMs: Date.now() - started, error: String(e) });
      return errorResponse(new ApiError("internal", "Something went wrong on our side.", 500));
    }
  };
}
