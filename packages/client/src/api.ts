// The API client the extension and the iPhone app share, and the web's `sameOrigin`. No platform imports, so it is
// tested under Node; each app supplies where the server is and how to authenticate.

// Reaching the server failed (offline, DNS, a 5xx, a 429): plucks wait in the queue and try again.
export class Unreachable extends Error {}
export class SignedOut extends Error {}
export class Refused extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export type ClientDeps = {
  server: () => Promise<string>;
  auth: () => Promise<string | null>; // "Bearer …", refreshing when it has to; throws Unreachable when it cannot ask
  onSignedOut: () => Promise<void>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type Init = { method?: string; json?: unknown; body?: BodyInit; contentType?: string };
export type Client = <T>(path: string, init?: Init) => Promise<T>;

export function createClient({ server, auth, onSignedOut, fetch: f = fetch, timeoutMs = 15_000 }: ClientDeps): Client {
  return async <T>(path: string, init: Init = {}) => {
    const header = await auth();
    if (!header) throw new SignedOut("Sign in to pluck.");
    // only the token speaks for the person, never a cookie
    const res = await send(f, `${await server()}${path}`, init, { credentials: "omit", headers: { authorization: header }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 401) await onSignedOut();
    return answer<T>(res);
  };
}

// The web's own pages: the same origin, so the session cookie speaks for the person.
export const sameOrigin = (f: typeof fetch = fetch): Client => async <T>(path: string, init: Init = {}) => answer<T>(await send(f, path, init, {}));

function send(f: typeof fetch, url: string, init: Init, req: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const contentType = init.json !== undefined ? "application/json" : init.contentType;
  return f(url, {
    ...req,
    method: init.method ?? (init.json === undefined && init.body === undefined ? "GET" : "POST"),
    headers: { ...req.headers, ...(contentType ? { "content-type": contentType } : {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  }).catch(() => {
    throw new Unreachable("Couldn't reach Pluck.");
  });
}

// What a response means: its JSON, or the error the queue and the screens act on. The web reads its own fetches with it.
export async function answer<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new SignedOut("Sign in again to pluck.");
  if (res.status >= 500 || res.status === 429) throw new Unreachable("Couldn't reach Pluck.");
  const body = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string; details?: unknown } } & T) | null;
  if (!res.ok) throw new Refused(body?.error?.code ?? "error", body?.error?.message ?? "That did not work.", res.status, body?.error?.details);
  return body as T;
}

export type Tokens = { access: string; refresh: string | null; expiresAt: number };

// The OAuth token endpoint. Null means the server said no (the code or refresh token is spent: sign in again).
// No connection, a 5xx or a 429 is Unreachable, so a device that is offline keeps its sign-in and its queue.
// It has the API's time limit too: every request waits on a refresh, so one that hung would hold every screen.
export async function tokenRequest(server: string, form: Record<string, string>, f: typeof fetch = fetch, timeoutMs = 15_000): Promise<Tokens | null> {
  const res = await f(`${server}/api/auth/oauth2/token`, {
    method: "POST", credentials: "omit", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
  if (!res || res.status >= 500 || res.status === 429) throw new Unreachable("Couldn't reach Pluck.");
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { access: t.access_token, refresh: t.refresh_token ?? null, expiresAt: Date.now() + t.expires_in * 1000 };
}
