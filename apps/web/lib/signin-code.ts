import { ApiError } from "./api";
import { auth } from "./auth";

const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const APP = "io.getpluck.app:/oauth";

// The location a Better Auth answer points at: a redirect, or the JSON it sends a caller that is not a browser.
const target = async (res: Response) =>
  res.headers.get("location") ?? ((await res.json().catch(() => null)) as { url?: string } | null)?.url ?? null;

// The iPhone app's other way in: the 6-digit code from the sign-in email, typed in the app (handy when the email
// is open on another device). It signs in with the code, carries on with the app's own OAuth request, and returns the
// redirect the email link would have reached, so the app finishes exactly as if the link had been tapped. PKCE means
// only the app that made the request can spend the code that comes back. The web session this makes stays, as it does
// after a link opened in Safari: the app's tokens belong to it (signing it out would end them). Its cookie never leaves
// this server.
export async function appRedirectFromCode({ email, code, authorize, ip }: { email: string; code: string; authorize: string; ip: string }): Promise<string> {
  const q = new URLSearchParams(authorize);
  if (q.get("redirect_uri") !== APP || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge"))
    throw new ApiError("bad_request", "That is not the iPhone app's sign-in request.", 400);

  const call = (path: string, init: { method?: string; cookie?: string; body?: unknown } = {}) =>
    auth.handler(new Request(`${ORIGIN}/api/auth${path}`, {
      method: init.method ?? "GET",
      headers: { origin: ORIGIN, accept: "application/json", "content-type": "application/json", "x-forwarded-for": ip, ...(init.cookie ? { cookie: init.cookie } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }));

  const signedIn = await call("/sign-in/email-otp", { method: "POST", body: { email, otp: code } });
  if (signedIn.status === 429) throw new ApiError("rate_limited", "Too many tries. Try again in an hour.", 429);
  if (!signedIn.ok) {
    const why = ((await signedIn.json().catch(() => null)) as { code?: string } | null)?.code;
    throw why === "TOO_MANY_ATTEMPTS" || why === "OTP_EXPIRED"
      ? new ApiError("code_spent", "That code has expired or had too many tries. Send a new one.", 400)
      : new ApiError("bad_code", "That code did not work.", 400);
  }
  const cookie = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  let url = await target(await call(`/oauth2/authorize?${q}`, { cookie }));
  if (url && new URL(url, ORIGIN).pathname === "/oauth/consent") {
    // Our own app, asked for from inside it by someone who has just proved the email: no screen to agree to itself.
    url = await target(await call("/oauth2/consent", { method: "POST", cookie, body: { accept: true, oauth_query: new URL(url, ORIGIN).search.slice(1) } }));
  }
  if (!url?.startsWith(`${APP}?`)) throw new Error(`authorize ended at ${url?.slice(0, 80)}`);
  return url;
}
