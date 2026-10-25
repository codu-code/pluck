import type { Locale } from "@pluck/i18n";
import { ApiError } from "./api";
import { APP_GRANT, APP_REDIRECT, auth, limitSignInEmails, REVIEW, signInCode } from "./auth";
import { sendEmail } from "./email";
import { appCodeEmail } from "./emails";

const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// The iPhone app signs in with a 6-digit code, never a link. A link would end at io.getpluck.app:/oauth through the
// operating system, and any app can claim that scheme; a code is typed in the app and the answer comes straight back
// over HTTPS. The server refuses to authorize that redirect for anything but the calls below (APP_GRANT in auth.ts).

// Step one: email the code. App Review's address has no mailbox, so the app asks for its password instead.
export async function sendAppCode(email: string, ip: string, locale: Locale): Promise<{ password: true } | { sent: true }> {
  const address = email.trim().toLowerCase();
  if (address === REVIEW?.email) return { password: true };
  try {
    await limitSignInEmails(address, ip);
  } catch {
    throw new ApiError("rate_limited", "Wait a minute before sending another code.", 429);
  }
  await sendEmail(appCodeEmail(address, await signInCode(address), locale));
  return { sent: true };
}

// The location a Better Auth answer points at: a redirect, or the JSON it sends a caller that is not a browser.
const target = async (res: Response) =>
  res.headers.get("location") ?? ((await res.json().catch(() => null)) as { url?: string } | null)?.url ?? null;

// Step two: the code (or App Review's password) signs in, then carries on with the app's own OAuth request, and the
// redirect the app would have been sent comes back in the answer. PKCE means only the app that made the request can
// spend the code in it. The web session this makes stays, as after any sign-in: the app's tokens belong to it (signing
// it out would end them). Its cookie never leaves this server.
export async function appRedirectFromCode(input: { email: string; authorize: string; ip: string } & ({ code: string } | { password: string })): Promise<string> {
  const q = new URLSearchParams(input.authorize);
  if (q.get("redirect_uri") !== APP_REDIRECT || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge"))
    throw new ApiError("bad_request", "That is not the iPhone app's sign-in request.", 400);

  const call = (path: string, init: { method?: string; cookie?: string; body?: unknown } = {}) =>
    auth.handler(new Request(`${ORIGIN}/api/auth${path}`, {
      method: init.method ?? "GET",
      headers: {
        origin: ORIGIN, accept: "application/json", "content-type": "application/json", "x-forwarded-for": input.ip, [APP_GRANT.header]: APP_GRANT.value,
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }));

  const signedIn = "code" in input
    ? await call("/sign-in/email-otp", { method: "POST", body: { email: input.email, otp: input.code } })
    : await call("/sign-in/email", { method: "POST", body: { email: input.email, password: input.password } });
  if (signedIn.status === 429) throw new ApiError("rate_limited", "Too many tries. Try again in an hour.", 429);
  if (!signedIn.ok) {
    const why = ((await signedIn.json().catch(() => null)) as { code?: string } | null)?.code;
    throw why === "TOO_MANY_ATTEMPTS" || why === "OTP_EXPIRED"
      ? new ApiError("code_spent", "That code has expired or had too many tries. Send a new one.", 400)
      : new ApiError("bad_code", "That did not work.", 400);
  }
  const cookie = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  let url = await target(await call(`/oauth2/authorize?${q}`, { cookie }));
  if (url && new URL(url, ORIGIN).pathname === "/oauth/consent") {
    // Our own app, asked for from inside it by someone who has just proved the email: no screen to agree to itself.
    url = await target(await call("/oauth2/consent", { method: "POST", cookie, body: { accept: true, oauth_query: new URL(url, ORIGIN).search.slice(1) } }));
  }
  if (!url?.startsWith(`${APP_REDIRECT}?`)) throw new Error(`authorize ended at ${url?.slice(0, 80)}`);
  return url;
}
