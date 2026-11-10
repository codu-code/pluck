import { signOut, startSignIn } from "./auth";
import { set, settings } from "./store";

// A person who runs their own Pluck names it in Options. The extension is installed able to reach one server; any
// other is an optional host permission, asked for one host at a time when they confirm its address, and given back
// when they leave it.

export type Typed = { origin: string } | { error: "notAddress" | "needsHttps" };

// What was typed, as an origin. https only, except a server on this computer: a token never crosses a network in the clear.
export function typedServer(input: string): Typed {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { error: "notAddress" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "notAddress" };
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return { error: "needsHttps" };
  return { origin: url.origin };
}

// What the browser is asked for: that host and nothing wider. No port: Firefox's patterns take none, and Chrome's
// without one match every port.
export function hostPattern(origin: string): string {
  const { protocol, hostname } = new URL(origin);
  return `${protocol}//${hostname}/*`;
}

// A Pluck server says so in its OAuth metadata: the sign-in page the extension opens next, and the library scopes.
async function isPluck(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/.well-known/oauth-authorization-server/api/auth`, { credentials: "omit", signal: AbortSignal.timeout(15_000) });
    const meta = (await res.json()) as { authorization_endpoint?: unknown; scopes_supported?: unknown };
    return res.ok && meta.authorization_endpoint === `${origin}/api/auth/oauth2/authorize` && Array.isArray(meta.scopes_supported) && meta.scopes_supported.includes("library:write");
  } catch {
    return false; // nothing there, not JSON, or no answer in time
  }
}

// Gives a host back, unless the server in use is on it too (another port). The build's own server cannot be given
// back, and the browser says so by refusing: that is fine.
const giveBack = async (origin: string, inUse: string) =>
  hostPattern(origin) === hostPattern(inUse) || (await browser.permissions.remove({ origins: [hostPattern(origin)] }).catch(() => false));

// The whole change of server, from the click that confirms it. "notAllowed" and "notPluck" change nothing.
export async function switchServer(from: string, to: string): Promise<"using" | "notAllowed" | "notPluck"> {
  // Before any await: the browser only asks while it is still handling the click. The server cannot be checked first,
  // because without the permission its answer cannot be read.
  const asked = browser.permissions.request({ origins: [hostPattern(to)] });
  if (!(await asked.catch(() => false))) return "notAllowed";
  if (!(await isPluck(to))) {
    await giveBack(to, from);
    return "notPluck";
  }
  await signOut(); // at the server being left, while it can still be reached: the session and the queue go
  await set({ settings: { ...(await settings()), server: to } });
  await giveBack(from, to);
  await startSignIn().catch(() => {}); // it could not register just now: Sign in in Options tries again
  return "using";
}
