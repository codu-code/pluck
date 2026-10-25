import { createHash, randomBytes } from "node:crypto";
import { expect, test, vi } from "vitest";

const mail = vi.hoisted(() => {
  process.env.REVIEW_EMAIL = "App-Review@example.test";
  process.env.REVIEW_PASSWORD = "a long review password";
  return [] as { to: string; subject: string; text: string; html: string }[];
});
vi.mock("./email", () => ({ sendEmail: async (e: { to: string; subject: string; text: string; html: string }) => void mail.push(e) }));

import { APP_REDIRECT, auth } from "./auth";
import { appRedirectFromCode, sendAppCode } from "./signin-code";

const BASE = process.env.BETTER_AUTH_URL!;
const SCOPE = "offline_access library:read library:write account";
let ip = 0;
const nextIp = () => `203.0.113.${++ip}`;
const call = (path: string, init: { method?: string; body?: unknown; form?: URLSearchParams; cookie?: string } = {}) =>
  auth.handler(new Request(`${BASE}/api/auth${path}`, {
    method: init.method ?? "POST",
    redirect: "manual",
    headers: {
      origin: BASE, "x-forwarded-for": nextIp(), "content-type": init.form ? "application/x-www-form-urlencoded" : "application/json",
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.method === "GET" ? undefined : (init.form ?? JSON.stringify(init.body)),
  }));

// The iPhone app's side, as lib/session.ts does it: register, make a PKCE pair, ask for a code.
async function appAsksFor() {
  const reg = (await (await call("/oauth2/register", { body: {
    client_name: "Pluck for iPhone", redirect_uris: [APP_REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"], scope: SCOPE, resources: [`${BASE}/api/v1`],
  } })).json()) as { client_id: string };
  const verifier = randomBytes(32).toString("base64url"), state = randomBytes(16).toString("base64url");
  const authorize = new URLSearchParams({
    response_type: "code", client_id: reg.client_id, redirect_uri: APP_REDIRECT, scope: SCOPE, state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${BASE}/api/v1`,
  }).toString();
  return { clientId: reg.client_id, verifier, state, authorize };
}

async function codeFor(email: string) {
  expect(await sendAppCode(email, nextIp(), "en")).toEqual({ sent: true });
  const sent = mail.findLast((m) => m.to === email)!;
  expect(sent.html).not.toMatch(/href=/); // a code and nothing to tap
  return { code: sent.text.match(/\b(\d{6})\b/)![1]!, subject: sent.subject };
}

test("the code from the app's email signs the iPhone app in, with no link, no browser and no consent screen", async () => {
  const a = await appAsksFor();
  const { code, subject } = await codeFor("code-user@example.test");
  expect(subject).toContain(code);
  const url = new URL((await appRedirectFromCode({ email: "code-user@example.test", code, authorize: a.authorize, ip: nextIp() })).replace(APP_REDIRECT, "http://app"));
  expect(url.searchParams.get("state")).toBe(a.state);
  const tokens = await call("/oauth2/token", { form: new URLSearchParams({
    grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: APP_REDIRECT, client_id: a.clientId, code_verifier: a.verifier, resource: `${BASE}/api/v1`,
  }) });
  expect(tokens.status, await tokens.clone().text()).toBe(200);
  expect(await tokens.json()).toMatchObject({ access_token: expect.any(String), refresh_token: expect.any(String) });
  // A code works once.
  await expect(appRedirectFromCode({ email: "code-user@example.test", code, authorize: a.authorize, ip: nextIp() })).rejects.toMatchObject({ code: "bad_code" });
});

test("no browser can get the app's redirect: not through authorize, not through consent, not through an email link", async () => {
  const a = await appAsksFor();
  // A signed-in browser asking to authorize the app's redirect is refused before any code exists.
  const session = await call("/sign-in/email", { body: { email: "app-review@example.test", password: "a long review password" } });
  expect(session.status).toBe(200);
  const cookie = session.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const authorize = await call(`/oauth2/authorize?${a.authorize}`, { method: "GET", cookie });
  expect(authorize.headers.get("location") ?? "").not.toMatch(/^io\.getpluck\.app/);
  expect([302, 403]).toContain(authorize.status);
  if (authorize.status === 302) expect(authorize.headers.get("location")).toMatch(/\/oauth\/error/);
  const consent = await call("/oauth2/consent", { body: { accept: true, oauth_query: a.authorize }, cookie });
  expect(JSON.stringify(await consent.json().catch(() => ({})))).not.toMatch(/io\.getpluck\.app/);
});

test("a wrong code, someone else's email, or another client's request gets nothing", async () => {
  const a = await appAsksFor();
  const { code } = await codeFor("other-user@example.test");
  const wrong = code === "000000" ? "111111" : "000000";
  await expect(appRedirectFromCode({ email: "other-user@example.test", code: wrong, authorize: a.authorize, ip: nextIp() })).rejects.toMatchObject({ code: "bad_code" });
  await expect(appRedirectFromCode({ email: "someone-else@example.test", code, authorize: a.authorize, ip: nextIp() })).rejects.toMatchObject({ code: "bad_code" });
  const elsewhere = new URLSearchParams(a.authorize);
  elsewhere.set("redirect_uri", "https://evil.example.test/cb");
  await expect(appRedirectFromCode({ email: "other-user@example.test", code, authorize: elsewhere.toString(), ip: nextIp() })).rejects.toMatchObject({ code: "bad_request" });
});

test("five wrong tries spend the code", async () => {
  const a = await appAsksFor();
  const { code } = await codeFor("guesser@example.test");
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await appRedirectFromCode({ email: "guesser@example.test", code: wrong, authorize: a.authorize, ip: nextIp() }).catch(() => {});
  await expect(appRedirectFromCode({ email: "guesser@example.test", code, authorize: a.authorize, ip: nextIp() })).rejects.toMatchObject({ code: "code_spent" });
});

test("one code a minute per address", async () => {
  await codeFor("minute@example.test");
  await expect(sendAppCode("Minute@Example.test", nextIp(), "en")).rejects.toMatchObject({ code: "rate_limited" });
});

test("App Review's address gets a password field, and its password signs the app in", async () => {
  expect(await sendAppCode("app-review@EXAMPLE.test", nextIp(), "en")).toEqual({ password: true });
  expect(mail.some((m) => m.to.startsWith("app-review"))).toBe(false);
  const a = await appAsksFor();
  await expect(appRedirectFromCode({ email: "app-review@example.test", password: "not it", authorize: a.authorize, ip: nextIp() })).rejects.toMatchObject({ code: "bad_code" });
  expect(await appRedirectFromCode({ email: "app-review@example.test", password: "a long review password", authorize: a.authorize, ip: nextIp() })).toMatch(/^io\.getpluck\.app:\/oauth\?code=/);
});

test("the email-code plugin's own sending and account routes are off", async () => {
  for (const path of ["/email-otp/send-verification-otp", "/email-otp/request-password-reset", "/email-otp/request-email-change", "/forget-password/email-otp"])
    expect((await call(path, { body: { email: "x@example.test", type: "sign-in" } })).status, path).toBe(404);
});
