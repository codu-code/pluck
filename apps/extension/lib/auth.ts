import { get, set, settings } from "./store";

// Sign-in is OAuth 2.1 with PKCE against the person's Pluck server. The authorisation runs in an ordinary tab,
// not a web-auth window, because the email link that signs you in opens in its own tab; wherever it ends,
// it lands on <server>/extension/connected?code=…, and the background reads the code from that tab.
const SCOPE = "offline_access library:read library:write";
const redirectFor = (server: string) => `${server}/extension/connected`;

type Pending = { server: string; clientId: string; verifier: string; state: string };

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

// Each server gets its own client registration (dynamic registration), made once and remembered.
async function clientIdFor(server: string): Promise<string> {
  const ids = await get("clientIds");
  if (ids[server]) return ids[server];
  const res = await fetch(`${server}/api/auth/oauth2/register`, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Pluck for your browser",
      redirect_uris: [redirectFor(server)],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
      resources: [`${server}/api/v1`],
    }),
  });
  if (!res.ok) throw new Error(`Could not register with ${server} (${res.status})`);
  const { client_id } = (await res.json()) as { client_id: string };
  await set({ clientIds: { ...ids, [server]: client_id } });
  return client_id;
}

export async function startSignIn(): Promise<void> {
  const { server } = await settings();
  const clientId = await clientIdFor(server);
  const pending: Pending = { server, clientId, verifier: random(), state: random(16) };
  await browser.storage.session.set({ pending });
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pending.verifier)));
  const q = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirectFor(server), scope: SCOPE, state: pending.state,
    code_challenge: challenge, code_challenge_method: "S256", resource: `${server}/api/v1`,
  });
  await browser.tabs.create({ url: `${server}/api/auth/oauth2/authorize?${q}` });
}

// Called by the background for every tab address change; true when it finished a sign-in.
export async function finishSignIn(url: string): Promise<boolean> {
  const { pending } = (await browser.storage.session.get("pending")) as { pending?: Pending };
  if (!pending || !url.startsWith(`${redirectFor(pending.server)}?`)) return false;
  const params = new URL(url).searchParams;
  if (params.get("state") !== pending.state || !params.get("code")) return false;
  await browser.storage.session.remove("pending");
  const tokens = await tokenRequest(pending.server, {
    grant_type: "authorization_code", code: params.get("code")!, redirect_uri: redirectFor(pending.server), client_id: pending.clientId,
    code_verifier: pending.verifier, resource: `${pending.server}/api/v1`,
  });
  if (!tokens) return false;
  await set({ tokens, apiKey: null });
  await rememberEmail();
  return true;
}

async function tokenRequest(server: string, form: Record<string, string>) {
  const res = await fetch(`${server}/api/auth/oauth2/token`, { method: "POST", credentials: "omit", body: new URLSearchParams(form) });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { access: t.access_token, refresh: t.refresh_token ?? null, expiresAt: Date.now() + t.expires_in * 1000 };
}

// The Authorization header for the API, refreshing an access token that is about to run out.
export async function authHeader(): Promise<string | null> {
  const apiKey = await get("apiKey");
  if (apiKey) return `Bearer ${apiKey}`;
  const tokens = await get("tokens");
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return `Bearer ${tokens.access}`;
  if (!tokens.refresh) return null;
  const { server } = await settings();
  const fresh = await tokenRequest(server, {
    grant_type: "refresh_token", refresh_token: tokens.refresh, client_id: (await get("clientIds"))[server] ?? "", resource: `${server}/api/v1`,
  });
  await set({ tokens: fresh });
  return fresh ? `Bearer ${fresh.access}` : null;
}

export async function useApiKey(key: string): Promise<boolean> {
  await set({ apiKey: key.trim(), tokens: null });
  if (await rememberEmail()) return true;
  await set({ apiKey: null });
  return false;
}

async function rememberEmail(): Promise<boolean> {
  const { server } = await settings();
  const header = await authHeader();
  if (!header) return false;
  const res = await fetch(`${server}/api/v1/me`, { credentials: "omit", headers: { authorization: header } });
  if (!res.ok) return false;
  await set({ email: ((await res.json()) as { me: { email: string } }).me.email });
  return true;
}

export async function signOut(): Promise<void> {
  const tokens = await get("tokens");
  const { server } = await settings();
  const clientId = (await get("clientIds"))[server];
  if (tokens?.refresh && clientId) {
    await fetch(`${server}/api/auth/oauth2/revoke`, {
      method: "POST", credentials: "omit", body: new URLSearchParams({ token: tokens.refresh, token_type_hint: "refresh_token", client_id: clientId }),
    }).catch(() => {});
  }
  await set({ tokens: null, apiKey: null, email: null });
}
