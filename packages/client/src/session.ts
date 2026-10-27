import { tokenRequest, type Tokens } from "./api";

// The signed-in session the extension and the iPhone app share. Where it is kept differs (browser storage, the Keychain),
// so each app passes a store; the rules for using and refreshing it live here once.
export type Stored = { server: string; clientId?: string; apiKey?: string | null; tokens?: Tokens | null };
export type SessionStore = {
  read: (fresh?: boolean) => Promise<Stored | null>; // fresh: skip any cache, another context may have written since
  write: (tokens: Tokens | null) => Promise<void>; // null: the server refused the refresh token, sign in again
  lock?: <T>(fn: () => Promise<T>) => Promise<T>; // held by every context that refreshes from the same store
};

// The header that works without asking the server: a personal key, or an access token with more than a minute left.
const ready = (s: Stored | null) =>
  s?.apiKey ? `Bearer ${s.apiKey}` : s?.tokens && s.tokens.expiresAt - Date.now() > 60_000 ? `Bearer ${s.tokens.access}` : null;

export function createSession(store: SessionStore, f: typeof fetch = fetch) {
  let refreshing: Promise<string | null> | null = null;

  // A refresh token works once, and of two refreshes at once the server refuses the second. So read the store again
  // under the lock (another context may have refreshed already), and treat a refusal as success if it did meanwhile.
  async function refresh(): Promise<string | null> {
    const s = await store.read(true);
    if (ready(s)) return ready(s);
    if (!s?.tokens?.refresh || !s.clientId) return null;
    const spent = s.tokens.refresh;
    const fresh = await tokenRequest(s.server, { grant_type: "refresh_token", refresh_token: spent, client_id: s.clientId, resource: `${s.server}/api/v1` }, f);
    if (fresh) {
      await store.write(fresh);
      return `Bearer ${fresh.access}`;
    }
    const now = await store.read(true); // the iPhone's share extension cannot share a lock with the app
    if (now?.tokens?.refresh !== spent && ready(now)) return ready(now);
    await store.write(null);
    return null;
  }

  return {
    // "Bearer …" for the API: a personal key, or an access token refreshed a minute before it runs out.
    // Offline throws Unreachable and keeps the tokens, so the pluck is queued rather than lost.
    async authHeader(): Promise<string | null> {
      const s = await store.read();
      if (ready(s) || !s?.tokens?.refresh) return ready(s);
      refreshing ??= (store.lock ? store.lock(refresh) : refresh()).finally(() => (refreshing = null));
      return refreshing;
    },

    isSignedIn: async () => {
      const s = await store.read();
      return Boolean(s?.apiKey || s?.tokens);
    },

    // Sign out, server side: the refresh token stops working. Each app then clears what it keeps.
    async revoke(): Promise<void> {
      const s = await store.read(true);
      if (!s?.tokens?.refresh || !s.clientId) return;
      await f(`${s.server}/api/auth/oauth2/revoke`, {
        method: "POST", credentials: "omit", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: s.tokens.refresh, token_type_hint: "refresh_token", client_id: s.clientId }).toString(),
      }).catch(() => {});
    },
  };
}

// Dynamic client registration: each app registers once per server and remembers the client_id itself.
export async function register(server: string, app: { name: string; redirect: string; scope: string }): Promise<string> {
  const res = await fetch(`${server}/api/auth/oauth2/register`, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: app.name, redirect_uris: [app.redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"], scope: app.scope, resources: [`${server}/api/v1`],
    }),
  });
  if (!res.ok) throw new Error(`Could not register with ${server} (${res.status})`);
  return ((await res.json()) as { client_id: string }).client_id;
}
