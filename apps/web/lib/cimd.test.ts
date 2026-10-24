import { afterEach, expect, test, vi } from "vitest";
import { auth } from "./auth";

const CLIENT = "https://client.example.test/oauth/pluck.json";
const REDIRECT = "http://127.0.0.1:4180/callback";

afterEach(() => vi.unstubAllGlobals());

// An AI tool that publishes its own metadata document (CIMD) needs no registration: the URL is its client_id.
test("a client_id metadata document is fetched and its redirect URIs are enforced", async () => {
  const real = globalThis.fetch;
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== CLIENT) return real(input, init);
    fetched.push(String(input));
    return Response.json({ client_id: CLIENT, client_name: "Example AI", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  });
  const authorize = (redirect: string) => {
    const q = new URLSearchParams({
      response_type: "code", client_id: CLIENT, redirect_uri: redirect, state: "s", scope: "library:read", code_challenge: "x".repeat(43),
      code_challenge_method: "S256", resource: `${process.env.BETTER_AUTH_URL}/mcp`,
    });
    return auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/oauth2/authorize?${q}`, { redirect: "manual" }));
  };

  const ok = await authorize(REDIRECT);
  expect(fetched).toEqual([CLIENT]);
  expect(ok.status).toBe(302);
  expect(ok.headers.get("location")).toMatch(/\/signin\?.*client_id=https%3A%2F%2Fclient\.example\.test/);

  const wrong = await authorize("https://evil.example.test/cb");
  expect(wrong.headers.get("location")).toMatch(/^\/oauth\/error\?error=/); // never to the unlisted redirect
});
