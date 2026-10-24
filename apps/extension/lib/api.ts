import { authHeader } from "./auth";
import { set, settings } from "./store";

// Reaching the server failed (offline, DNS, a 5xx): plucks wait in the queue and try again.
export class Unreachable extends Error {}
export class SignedOut extends Error {}
export class Refused extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

type Init = { method?: string; json?: unknown; body?: BodyInit; contentType?: string };

// Cookies are never sent: the extension speaks only with its own token.
export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const { server } = await settings();
  const auth = await authHeader().catch(() => null);
  if (!auth) throw new SignedOut("Sign in to pluck.");
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, {
      method: init.method ?? (init.json === undefined && init.body === undefined ? "GET" : "POST"),
      credentials: "omit",
      headers: { authorization: auth, ...(init.json !== undefined ? { "content-type": "application/json" } : init.contentType ? { "content-type": init.contentType } : {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new Unreachable("Couldn't reach Pluck.");
  }
  if (res.status === 401) {
    await set({ tokens: null, email: null });
    throw new SignedOut("Sign in again to pluck.");
  }
  if (res.status >= 500 || res.status === 429) throw new Unreachable("Couldn't reach Pluck.");
  const body = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
  if (!res.ok) throw new Refused(body?.error?.code ?? "error", body?.error?.message ?? "That did not work.", res.status);
  return body as T;
}

export const openInPluck = async (path: string) => browser.tabs.create({ url: `${(await settings()).server}${path}` });
