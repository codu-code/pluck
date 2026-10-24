// The API client, without any Expo imports so it is tested under Node. The app supplies how to authenticate.
export class Unreachable extends Error {}
export class SignedOut extends Error {}
export class Refused extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export type ClientDeps = {
  server: () => Promise<string>;
  auth: () => Promise<string | null>; // "Bearer …", refreshing when it has to
  onSignedOut: () => Promise<void>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type Client = <T>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;

export function createClient({ server, auth, onSignedOut, fetch: f = fetch, timeoutMs = 15_000 }: ClientDeps): Client {
  return async <T>(path: string, init: { method?: string; json?: unknown } = {}) => {
    const header = await auth();
    if (!header) throw new SignedOut("Sign in to pluck.");
    let res: Response;
    try {
      res = await f(`${await server()}${path}`, {
        method: init.method ?? (init.json === undefined ? "GET" : "POST"),
        headers: { authorization: header, ...(init.json === undefined ? {} : { "content-type": "application/json" }) },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new Unreachable("Couldn't reach Pluck.");
    }
    if (res.status === 401) {
      await onSignedOut();
      throw new SignedOut("Sign in again to pluck.");
    }
    if (res.status >= 500 || res.status === 429) throw new Unreachable("Couldn't reach Pluck.");
    const body = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string; details?: unknown } } & T) | null;
    if (!res.ok) throw new Refused(body?.error?.code ?? "error", body?.error?.message ?? "That did not work.", res.status, body?.error?.details);
    return body as T;
  };
}
