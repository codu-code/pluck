import { createHash, randomBytes } from "node:crypto";
import { expect, test, vi } from "vitest";

const mail = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("./email", () => ({ sendEmail: async (e: { to: string; subject: string; text: string }) => void mail.push(e) }));

import { auth } from "./auth";
import { appRedirectFromCode } from "./signin-code";

const BASE = process.env.BETTER_AUTH_URL!;
const APP = "io.getpluck.app:/oauth";
const SCOPE = "offline_access library:read library:write account";
let ip = 0;
const call = (path: string, init: { method?: string; body?: unknown; form?: URLSearchParams } = {}) =>
  auth.handler(new Request(`${BASE}/api/auth${path}`, {
    method: init.method ?? "POST",
    headers: { origin: BASE, "x-forwarded-for": `203.0.113.${++ip}`, "content-type": init.form ? "application/x-www-form-urlencoded" : "application/json" },
    body: init.form ?? JSON.stringify(init.body),
  }));

// The iPhone app's side, as lib/session.ts does it: register, make a PKCE pair, ask for a link and code.
async function appAsksFor(email: string) {
  const reg = (await (await call("/oauth2/register", { body: {
    client_name: "Pluck for iPhone", redirect_uris: [APP], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"], scope: SCOPE, resources: [`${BASE}/api/v1`],
  } })).json()) as { client_id: string };
  const verifier = randomBytes(32).toString("base64url"), state = randomBytes(16).toString("base64url");
  const authorize = new URLSearchParams({
    response_type: "code", client_id: reg.client_id, redirect_uri: APP, scope: SCOPE, state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${BASE}/api/v1`,
  }).toString();
  expect((await call("/sign-in/magic-link", { body: { email, callbackURL: `/api/auth/oauth2/authorize?${authorize}` } })).status).toBe(200);
  const sent = mail.findLast((m) => m.to === email)!;
  const code = sent.text.match(/\b(\d{6})\b/)![1]!;
  return { clientId: reg.client_id, verifier, state, authorize, code, subject: sent.subject };
}

test("the code from the sign-in email signs the iPhone app in, with no browser and no consent screen", async () => {
  const a = await appAsksFor("code-user@example.test");
  expect(a.subject).toContain(a.code);
  const url = new URL((await appRedirectFromCode({ email: "code-user@example.test", code: a.code, authorize: a.authorize, ip: "203.0.113.200" })).replace(APP, "http://app"));
  expect(url.searchParams.get("state")).toBe(a.state);
  const tokens = await call("/oauth2/token", { form: new URLSearchParams({
    grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: APP, client_id: a.clientId, code_verifier: a.verifier, resource: `${BASE}/api/v1`,
  }) });
  expect(tokens.status, await tokens.clone().text()).toBe(200);
  expect(await tokens.json()).toMatchObject({ access_token: expect.any(String), refresh_token: expect.any(String) });
  // A code works once.
  await expect(appRedirectFromCode({ email: "code-user@example.test", code: a.code, authorize: a.authorize, ip: "203.0.113.201" })).rejects.toMatchObject({ code: "bad_code" });
});

test("a wrong code, someone else's email, or another client's request gets nothing", async () => {
  const a = await appAsksFor("other-user@example.test");
  const wrong = a.code === "000000" ? "111111" : "000000";
  await expect(appRedirectFromCode({ email: "other-user@example.test", code: wrong, authorize: a.authorize, ip: "203.0.113.202" })).rejects.toMatchObject({ code: "bad_code" });
  await expect(appRedirectFromCode({ email: "someone-else@example.test", code: a.code, authorize: a.authorize, ip: "203.0.113.203" })).rejects.toMatchObject({ code: "bad_code" });
  const elsewhere = new URLSearchParams(a.authorize);
  elsewhere.set("redirect_uri", "https://evil.example.test/cb");
  await expect(appRedirectFromCode({ email: "other-user@example.test", code: a.code, authorize: elsewhere.toString(), ip: "203.0.113.204" })).rejects.toMatchObject({ code: "bad_request" });
});

test("five wrong tries spend the code", async () => {
  const a = await appAsksFor("guesser@example.test");
  const wrong = a.code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await appRedirectFromCode({ email: "guesser@example.test", code: wrong, authorize: a.authorize, ip: `198.51.100.${10 + i}` }).catch(() => {});
  await expect(appRedirectFromCode({ email: "guesser@example.test", code: a.code, authorize: a.authorize, ip: "203.0.113.206" })).rejects.toMatchObject({ code: "code_spent" });
});

test("the plugin's own sending and account routes are off", async () => {
  for (const path of ["/email-otp/send-verification-otp", "/email-otp/request-password-reset", "/email-otp/request-email-change", "/forget-password/email-otp"])
    expect((await call(path, { body: { email: "x@example.test", type: "sign-in" } })).status, path).toBe(404);
});
