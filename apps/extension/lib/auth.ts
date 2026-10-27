import { createSession, pkcePair, register, tokenRequest } from "@pluck/client";
import { get, set, settings } from "./store";

// Sign-in is OAuth 2.1 with PKCE against the person's Pluck server. The authorisation runs in an ordinary tab,
// not a web-auth window, because the email link that signs you in opens in its own tab; wherever it ends,
// it lands on <server>/extension/connected?code=…, and the background reads the code from that tab.
const SCOPE = "offline_access library:read library:write library:delete"; // delete: Undo and Delete send an Item to the bin
const redirectFor = (server: string) => `${server}/extension/connected`;
const clientKey = (server: string) => `${server} ${SCOPE}`;

type Pending = { server: string; clientId: string; verifier: string; state: string };

// Each server gets its own client registration (dynamic registration), made once and remembered for these scopes:
// a registration made before a scope was added cannot ask for it, so a new SCOPE registers again.
async function clientIdFor(server: string): Promise<string> {
  const ids = await get("clientIds");
  const key = clientKey(server);
  if (ids[key]) return ids[key];
  const clientId = await register(server, { name: "Pluck for your browser", redirect: redirectFor(server), scope: SCOPE });
  await set({ clientIds: { ...ids, [key]: clientId } });
  return clientId;
}

export async function startSignIn(): Promise<void> {
  const { server } = await settings();
  const clientId = await clientIdFor(server);
  const { verifier, challenge, state } = await pkcePair(
    (n) => crypto.getRandomValues(new Uint8Array(n)),
    async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))),
  );
  await browser.storage.session.set({ pending: { server, clientId, verifier, state } satisfies Pending });
  const q = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirectFor(server), scope: SCOPE, state,
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
  }).catch(() => null); // offline at this step: sign in again
  if (!tokens) return false;
  await set({ tokens, apiKey: null });
  await rememberEmail();
  return true;
}

// The popup, the options page and the service worker each load this, so the refresh is guarded by a Web Lock,
// which all of them share, not by memory, which they do not.
const session = createSession({
  read: async () => {
    const { server } = await settings();
    return { server, clientId: (await get("clientIds"))[clientKey(server)], apiKey: await get("apiKey"), tokens: await get("tokens") };
  },
  write: (tokens) => set({ tokens }),
  lock: async (fn) => await navigator.locks.request("pluck-refresh", fn),
});

export const { authHeader, isSignedIn } = session;

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
  await session.revoke();
  await set({ tokens: null, apiKey: null, email: null });
}
