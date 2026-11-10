import { expect, test, vi } from "vitest";
import { auth, FIRST_PARTY_REDIRECTS, signInCode } from "./auth";
import { clientIp } from "./ip";

const BASE = process.env.BETTER_AUTH_URL;
let ip = 0;
const post = (path: string, body: unknown) =>
  auth.handler(new Request(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip}` }, // a fresh address per call, so only our own limits bite
    body: JSON.stringify(body),
  }));
const register = (client_name: string, redirect: string, resources?: string[], scope?: string) =>
  post("/oauth2/register", {
    client_name, redirect_uris: [redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"],
    ...(resources ? { resources } : {}), ...(scope ? { scope } : {}),
  });

test("only our own apps can register for the REST API or go by Pluck's name", async () => {
  const api = `${BASE}/api/v1`;
  expect((await register("Pluck for your browser", "https://evil.example.test/cb", [api])).status).toBe(400);
  expect((await register("Reader", "https://evil.example.test/cb", [api])).status).toBe(400);
  expect((await register("pluck helper", "https://evil.example.test/cb")).status).toBe(400);
  expect((await register("Pluck for your browser", FIRST_PARTY_REDIRECTS[0]!, [api])).status).toBe(201);
  expect((await register("Pluck for iPhone", "io.getpluck.app:/oauth", [api])).status).toBe(201);
  expect((await register("Example AI", "https://ai.example.test/cb")).status).toBe(201); // AI tools still register for the connector
});

test("only our own apps can ask for the account scope", async () => {
  expect((await register("Example AI", "https://ai.example.test/cb", undefined, "library:read account")).status).toBe(400);
  expect((await register("Pluck for iPhone", "io.getpluck.app:/oauth", [`${BASE}/api/v1`], "offline_access library:read library:write account")).status).toBe(201);
});

test("nobody edits a client or a grant after the fact, signed in or not: those routes are off", async () => {
  const email = `owner-${Date.now()}@example.test`;
  const signedIn = await post("/sign-in/email-otp", { email, otp: await signInCode(email) });
  expect(signedIn.status).toBe(200);
  const cookie = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const paths = ["/oauth2/create-client", "/oauth2/update-client", "/oauth2/delete-client", "/oauth2/client/rotate-secret", "/oauth2/client/rotate-keys", "/oauth2/update-consent", "/oauth2/delete-consent"];
  for (const path of paths) {
    const res = await auth.handler(new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE!, cookie, "x-forwarded-for": `198.51.100.${++ip}` },
      body: JSON.stringify({ client_id: "x", redirect_uris: ["https://evil.example.test/cb"], update: { redirect_uris: ["https://evil.example.test/cb"] } }),
    }));
    expect(res.status, path).toBe(404);
  }
});

test("an AI tool that names no scope gets read and write, never delete or the account", async () => {
  const { client_id } = (await (await register("Example AI", "https://ai.example.test/cb")).json()) as { client_id: string };
  const authorize = (scope?: string) =>
    auth.handler(new Request(`${BASE}/api/auth/oauth2/authorize?${new URLSearchParams({
      response_type: "code", client_id, redirect_uri: "https://ai.example.test/cb", state: "s", code_challenge_method: "S256",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", resource: `${BASE}/mcp`, ...(scope ? { scope } : {}),
    })}`, { headers: { "x-forwarded-for": `198.51.100.${++ip}` } }));
  const scopeOf = (res: Response) => new URL(res.headers.get("location") ?? "", BASE).searchParams.get("scope");
  expect(scopeOf(await authorize())).toBe("offline_access library:read library:write"); // on to sign-in, narrowed
  expect(scopeOf(await authorize("library:read library:delete"))).toBe("library:read library:delete"); // named, so the consent screen shows it
  expect((await authorize("library:read account")).status).toBe(400);
});

test("sign-in links are limited per address, whatever network asks: one a minute, six an hour", async () => {
  const email = `limit-${Date.now()}@example.test`;
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2030-01-01T10:00:01Z"));
    expect((await post("/sign-in/magic-link", { email })).status).toBe(200);
    expect((await post("/sign-in/magic-link", { email: email.toUpperCase() })).status).toBe(429); // within the minute
    expect((await post("/sign-in/magic-link", { email: `other-${email}` })).status).toBe(200);
    for (let i = 1; i < 6; i++) {
      vi.setSystemTime(new Date(Date.parse("2030-01-01T10:00:01Z") + i * 61_000));
      expect((await post("/sign-in/magic-link", { email })).status).toBe(200);
    }
    vi.setSystemTime(new Date(Date.parse("2030-01-01T10:00:01Z") + 6 * 61_000));
    expect((await post("/sign-in/magic-link", { email })).status).toBe(429); // the seventh in the hour
  } finally {
    vi.useRealTimers();
  }
});

test("with no review account set, nobody signs in with a password", async () => {
  expect((await post("/sign-in/email", { email: "apple-review@example.test", password: "anything at all" })).status).toBe(401);
});

test("the caller's address is the one our proxy added, not one the client made up", () => {
  const ipOf = (h: Record<string, string>) => clientIp({ headers: new Headers(h) });
  expect(ipOf({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" })).toBe("203.0.113.9");
  expect(ipOf({ "x-forwarded-for": "203.0.113.9" })).toBe("203.0.113.9");
  expect(ipOf({ "x-real-ip": "203.0.113.7" })).toBe("203.0.113.7");
  expect(ipOf({})).toBe("local");
});
