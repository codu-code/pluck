import { ExtensionStorage } from "@bacons/apple-targets";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { Directory, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { codeFrom, createClient, createSession, pkcePair, register, sameOwner, tokenRequest, whoIs } from "@pluck/client";
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
  userId?: string; // who this is where no token says so: a key's session, and what is left of one the server refused
};

const STORE = { keychainService: "pluck", keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
// The redirect the app registers: never dispatched by iOS (the app does not claim the scheme), only matched by the server.
export const REDIRECT = "io.getpluck.app:/oauth";
// "account": AI tools, export and deleting the account from Settings (the server lets only Pluck's own apps ask).
// "library:delete": Delete in the Archive and Delete forever in the Bin.
const SCOPE = "offline_access library:read library:write library:delete account";
export const defaultServer: string = (Constants.expoConfig?.extra as { server?: string } | undefined)?.server ?? "https://getpluck.io";
// The App Group the share extension shares: the Tags and List its sheet shows, and what it could not send.
export const GROUP: string = (Constants.expoConfig?.extra as { appGroup?: string } | undefined)?.appGroup ?? "group.io.getpluck.app";
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

const who = (s: Session | null) => s?.userId ?? whoIs(s?.access);

// The server refused the token: show sign-in rather than screens where every request fails. The library on the phone
// goes (app/_layout.tsx), but what waits to go up stays, with the id of whose it is: the same person will most likely
// sign straight back in.
function refused(s: Session) {
  const userId = who(s);
  return setSession({ server: s.server, ...(userId ? { userId } : {}) });
}

// What one person left waiting never goes up as another: the queue, what the share sheet could not send (pending/ in
// the App Group), and the Tags and List the sheet remembers.
async function clearWaiting(): Promise<void> {
  await kv.remove("queue");
  const container = Paths.appleSharedContainers[GROUP];
  const pending = container ? new Directory(container, "pending") : null;
  if (pending?.exists) pending.delete();
  const shared = new ExtensionStorage(GROUP);
  shared.set("tags", undefined);
  shared.set("lastList", undefined);
}

// A sign-in, before its session is written (so nothing is sent in between): the same person back on the same server
// keeps what waits, anyone else starts with nothing waiting.
async function arrive(server: string, userId: string | null): Promise<void> {
  const was = await getSession();
  if (was?.server !== server || !sameOwner(who(was), userId)) await clearWaiting();
}

// The share extension (Swift) refreshes from the same Keychain item and cannot share a lock with the app, so the
// session re-reads the Keychain before refreshing and keeps the extension's tokens when it got there first.
const session = createSession({
  read: async (fresh) => {
    if (fresh) current = undefined;
    const s = await getSession();
    return s && { server: s.server, clientId: s.clientId, apiKey: s.apiKey, tokens: s.access ? { access: s.access, refresh: s.refresh ?? null, expiresAt: s.expiresAt ?? 0 } : null };
  },
  write: async (t) => {
    const s = await getSession();
    if (s) await (t ? setSession({ ...s, ...t }) : refused(s));
  },
});

export const { authHeader, isSignedIn } = session;

// ---- OAuth with PKCE ---------------------------------------------------------------------------------

async function clientIdFor(server: string): Promise<string> {
  // v3: registered with library:delete; a client from before cannot ask for it, so it registers again.
  const ids = await kv.get<Record<string, string>>("clientIds.v3", {});
  if (ids[server]) return ids[server];
  const clientId = await register(server, { name: "Pluck for iPhone", redirect: REDIRECT, scope: SCOPE });
  await kv.set("clientIds.v3", { ...ids, [server]: clientId });
  return clientId;
}

type Pending = { server: string; clientId: string; verifier: string; state: string; challenge: string; at: number };

// One PKCE pair per sign-in attempt, kept while the code is valid (10 minutes), so a code sent again still matches.
async function pendingFor(server: string): Promise<Pending> {
  const raw = await SecureStore.getItemAsync("pending", STORE);
  const old = raw ? (JSON.parse(raw) as Partial<Pending>) : null;
  if (old?.challenge && old.server === server && Date.now() - (old.at ?? 0) < 10 * 60_000) return old as Pending;
  const clientId = await clientIdFor(server);
  const { verifier, challenge, state } = await pkcePair(
    (n) => Crypto.getRandomBytes(n),
    async (s) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(s))),
  );
  const pending = { server, clientId, verifier, state, challenge, at: Date.now() };
  await SecureStore.setItemAsync("pending", JSON.stringify(pending), STORE);
  return pending;
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", "accept-language": locale }, body: JSON.stringify(body) });

// Sign in, step one: the server emails a 6-digit code. Never a link: a link would come back through the
// io.getpluck.app scheme, which another app could claim, so the server will not authorize that redirect from a browser
// at all. "password" is App Review's account, which has no mailbox.
export async function sendSignInCode(email: string, server = defaultServer): Promise<"sent" | "password" | "limited" | "error"> {
  try {
    await pendingFor(server);
    const res = await post(`${server}/api/v1/signin/send-code`, { email: email.trim() });
    if (res.status === 429) return "limited";
    if (!res.ok) return "error";
    return ((await res.json().catch(() => null)) as { password?: boolean } | null)?.password ? "password" : "sent";
  } catch {
    return "error";
  }
}

// Step two: the code (or App Review's password) for this app's own OAuth request. The answer is the redirect, straight
// back over HTTPS, and the PKCE verifier that only this app holds turns it into tokens.
export async function signInWithCode(email: string, secret: { code: string } | { password: string }, server = defaultServer): Promise<"ok" | "bad" | "spent" | "limited" | "error"> {
  try {
    const p = await pendingFor(server);
    const authorize = new URLSearchParams({
      response_type: "code", client_id: p.clientId, redirect_uri: REDIRECT, scope: SCOPE, state: p.state, code_challenge: p.challenge,
      code_challenge_method: "S256", resource: `${p.server}/api/v1`,
    }).toString();
    const res = await post(`${server}/api/v1/signin/code`, { email: email.trim(), ...secret, authorize });
    if (res.status === 429) return "limited";
    const body = (await res.json().catch(() => null)) as { url?: string; error?: { code?: string } } | null;
    if (!res.ok) return body?.error?.code === "bad_code" ? "bad" : body?.error?.code === "code_spent" ? "spent" : "error";
    return body?.url && (await finishSignIn(p, body.url)) ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function finishSignIn(p: Pending, url: string): Promise<boolean> {
  const code = codeFrom(url, p.state);
  if (!code) return false;
  const tokens = await tokenRequest(p.server, {
    grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: p.clientId, code_verifier: p.verifier, resource: `${p.server}/api/v1`,
  }).catch(() => null); // offline at this step: try the code again
  if (!tokens) return false;
  await SecureStore.deleteItemAsync("pending", STORE);
  await arrive(p.server, whoIs(tokens.access));
  await setSession({ server: p.server, clientId: p.clientId, ...tokens });
  await rememberEmail();
  return true;
}

export async function signInWithKey(server: string, key: string): Promise<boolean> {
  const res = await fetch(`${server}/api/v1/me`, { headers: { authorization: `Bearer ${key.trim()}` } }).catch(() => null);
  if (!res?.ok) return false;
  const { me } = (await res.json()) as { me: { id: string; email: string } };
  await arrive(server, me.id);
  await setSession({ server, apiKey: key.trim(), email: me.email, userId: me.id });
  return true;
}

async function rememberEmail() {
  const me = await api<{ me: { email: string } }>("/api/v1/me").catch(() => null);
  const s = await getSession();
  if (me && s) await setSession({ ...s, email: me.me.email });
}

export async function signOut(): Promise<void> {
  await session.revoke();
  await clearWaiting().catch(() => {}); // signed out by hand: nothing waits for anyone. A leftover goes at the next sign-in.
  await setSession(null);
}

export const api = createClient({
  server: async () => (await getSession())?.server ?? defaultServer,
  auth: authHeader,
  onSignedOut: async () => {
    const s = await getSession();
    if (s) await refused(s);
  },
});
