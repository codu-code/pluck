import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { codeFrom, createClient, pkcePair, tokenRequest } from "@pluck/client";
import { locale } from "./i18n";
import { kv } from "./kv";

// The signed-in session lives in the Keychain, in the access group the share extension also reads
// (the app's default group: the first one in keychain-access-groups).
export type Session = {
  server: string;
  clientId?: string;
  access?: string;
  refresh?: string | null;
  expiresAt?: number;
  apiKey?: string;
  email?: string;
};

const STORE = { keychainService: "pluck", keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
export const REDIRECT = "io.getpluck.app:/oauth";
// "account": AI tools, export and deleting the account from Settings (the server lets only Pluck's own apps ask).
const SCOPE = "offline_access library:read library:write account";
export const defaultServer: string = (Constants.expoConfig?.extra as { server?: string } | undefined)?.server ?? "https://getpluck.io";
export const showServerChoice = Boolean((Constants.expoConfig?.extra as { showServer?: boolean } | undefined)?.showServer);

let current: Session | null | undefined;
const listeners = new Set<(s: Session | null) => void>();
export const onSession = (fn: (s: Session | null) => void) => (listeners.add(fn), () => void listeners.delete(fn));

export async function getSession(): Promise<Session | null> {
  if (current !== undefined) return current;
  const raw = await SecureStore.getItemAsync("session", STORE);
  current = raw ? (JSON.parse(raw) as Session) : null;
  return current;
}

async function setSession(s: Session | null) {
  current = s;
  if (s) await SecureStore.setItemAsync("session", JSON.stringify(s), STORE);
  else await SecureStore.deleteItemAsync("session", STORE);
  listeners.forEach((fn) => fn(s));
}

const signedIn = (s: Session | null) => Boolean(s?.access || s?.apiKey);
export const isSignedIn = async () => signedIn(await getSession());

// ---- OAuth with PKCE ---------------------------------------------------------------------------------

async function clientIdFor(server: string): Promise<string> {
  // v2: registered with the account scope; a client from before cannot ask for it, so it registers again.
  const ids = await kv.get<Record<string, string>>("clientIds.v2", {});
  if (ids[server]) return ids[server];
  const res = await fetch(`${server}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Pluck for iPhone", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: SCOPE, resources: [`${server}/api/v1`],
    }),
  });
  if (!res.ok) throw new Error(`Could not reach ${server}.`);
  const { client_id } = (await res.json()) as { client_id: string };
  await kv.set("clientIds.v2", { ...ids, [server]: client_id });
  return client_id;
}

type Pending = { server: string; clientId: string; verifier: string; state: string; challenge?: string; at?: number };

// One PKCE pair per sign-in attempt. Sending another link within the link's 10 minutes reuses it, so the
// earlier email still works too instead of reading as "from an earlier try".
async function pendingFor(server: string): Promise<Pending & { challenge: string }> {
  const raw = await SecureStore.getItemAsync("pending", STORE);
  const old = raw ? (JSON.parse(raw) as Pending) : null;
  if (old?.challenge && old.server === server && Date.now() - (old.at ?? 0) < 10 * 60_000) return old as Pending & { challenge: string };
  const clientId = await clientIdFor(server);
  const { verifier, challenge, state } = await pkcePair(
    (n) => Crypto.getRandomBytes(n),
    async (s) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(s))),
  );
  const pending = { server, clientId, verifier, state, challenge, at: Date.now() };
  await SecureStore.setItemAsync("pending", JSON.stringify(pending), STORE);
  return pending;
}

const authorizePath = (p: Pending & { challenge: string }) =>
  `/api/auth/oauth2/authorize?${new URLSearchParams({
    response_type: "code", client_id: p.clientId, redirect_uri: REDIRECT, scope: SCOPE, state: p.state, code_challenge: p.challenge,
    code_challenge_method: "S256", resource: `${p.server}/api/v1`,
  })}`;

// Emails a sign-in link from the app itself, no browser sheet. The link carries on with this app's OAuth request,
// so tapping it (in Safari, from Mail) ends at io.getpluck.app:/oauth and finishSignIn takes it from there.
// "password" is App Review's account, which has no mailbox: that one signs in through the web sheet.
export async function sendSignInLink(email: string, server = defaultServer): Promise<"sent" | "password" | "limited" | "error"> {
  try {
    const p = await pendingFor(server);
    const res = await fetch(`${server}/api/auth/sign-in/magic-link`, {
      method: "POST",
      // Origin: the server checks it on any request that names a callbackURL.
      headers: { "content-type": "application/json", "accept-language": locale, origin: server },
      body: JSON.stringify({ email: email.trim(), callbackURL: authorizePath(p) }),
    });
    if (res.status === 429) return "limited";
    if (!res.ok) return "error";
    return ((await res.json().catch(() => null)) as { password?: boolean } | null)?.password ? "password" : "sent";
  } catch {
    return "error";
  }
}

// The other way in: the 6-digit code from the same email, typed in the app (the email may be open on another device).
// The server spends the code on this app's pending request and returns the redirect the link would have reached.
export async function signInWithCode(email: string, code: string, server = defaultServer): Promise<"ok" | "bad" | "spent" | "limited" | "error"> {
  try {
    const p = await pendingFor(server);
    const res = await fetch(`${server}/api/v1/signin/code`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": locale },
      body: JSON.stringify({ email: email.trim(), code, authorize: authorizePath(p).split("?")[1] }),
    });
    if (res.status === 429) return "limited";
    const body = (await res.json().catch(() => null)) as { url?: string; error?: { code?: string } } | null;
    if (!res.ok) return body?.error?.code === "bad_code" ? "bad" : body?.error?.code === "code_spent" ? "spent" : "error";
    return body?.url && (await finishSignIn(body.url)) ? "ok" : "error";
  } catch {
    return "error";
  }
}

// Signs in in a web authentication session: a self-hosted server's own page, or App Review's password.
export async function signIn(server = defaultServer): Promise<boolean> {
  const p = await pendingFor(server);
  const result = await WebBrowser.openAuthSessionAsync(`${server}${authorizePath(p)}`, REDIRECT);
  return result.type === "success" ? finishSignIn(result.url) : isSignedIn();
}

export async function finishSignIn(url: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync("pending", STORE);
  if (!raw) return isSignedIn();
  const p = JSON.parse(raw) as Pending;
  const code = codeFrom(url, p.state);
  if (!code) return false;
  await SecureStore.deleteItemAsync("pending", STORE);
  WebBrowser.dismissAuthSession();
  const tokens = await tokenRequest(p.server, {
    grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: p.clientId, code_verifier: p.verifier, resource: `${p.server}/api/v1`,
  }).catch(() => null); // offline at this step: sign in again
  if (!tokens) return false;
  await setSession({ server: p.server, clientId: p.clientId, ...tokens });
  await rememberEmail();
  return true;
}

let refreshing: Promise<string | null> | null = null;

// "Bearer …" for the API: a personal key, or an access token refreshed a minute before it runs out.
export async function authHeader(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.apiKey) return `Bearer ${s.apiKey}`;
  if (s.access && (s.expiresAt ?? 0) - Date.now() > 60_000) return `Bearer ${s.access}`;
  refreshing ??= (async () => {
    // The share extension refreshes too, and a refresh token works once: spending the one this app read at launch
    // after the extension replaced it signs both out. So read the Keychain again first.
    current = undefined;
    const now = await getSession();
    if (!now?.refresh || !now.clientId) return null;
    if (now.access && (now.expiresAt ?? 0) - Date.now() > 60_000) return `Bearer ${now.access}`;
    const t = await tokenRequest(now.server, { grant_type: "refresh_token", refresh_token: now.refresh, client_id: now.clientId, resource: `${now.server}/api/v1` });
    if (!t) {
      await setSession({ server: now.server }); // refused: show sign-in rather than screens where every request fails
      return null;
    }
    await setSession({ ...now, ...t });
    return `Bearer ${t.access}`;
  })().finally(() => (refreshing = null));
  return refreshing;
}

export async function signInWithKey(server: string, key: string): Promise<boolean> {
  const res = await fetch(`${server}/api/v1/me`, { headers: { authorization: `Bearer ${key.trim()}` } }).catch(() => null);
  if (!res?.ok) return false;
  const { me } = (await res.json()) as { me: { email: string } };
  await setSession({ server, apiKey: key.trim(), email: me.email });
  return true;
}

async function rememberEmail() {
  const me = await api<{ me: { email: string } }>("/api/v1/me").catch(() => null);
  const s = await getSession();
  if (me && s) await setSession({ ...s, email: me.me.email });
}

export async function signOut(): Promise<void> {
  const s = await getSession();
  if (s?.refresh && s.clientId) {
    await fetch(`${s.server}/api/auth/oauth2/revoke`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: s.refresh, token_type_hint: "refresh_token", client_id: s.clientId }).toString(),
    }).catch(() => {});
  }
  await setSession(null);
}

export const api = createClient({
  server: async () => (await getSession())?.server ?? defaultServer,
  auth: authHeader,
  onSignedOut: async () => {
    const s = await getSession();
    if (s) await setSession({ server: s.server });
  },
});
