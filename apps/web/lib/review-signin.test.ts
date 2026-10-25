import { expect, test, vi } from "vitest";

// Review mode on for this file only: the env vars are read when auth.ts loads.
const sent = vi.hoisted(() => {
  process.env.REVIEW_EMAIL = "Apple-Review@example.test";
  process.env.REVIEW_PASSWORD = "a long review password";
  return [] as string[];
});
vi.mock("./email", () => ({ sendEmail: async (e: { to: string }) => void sent.push(e.to) }));

import { auth, REVIEW } from "./auth";

const BASE = process.env.BETTER_AUTH_URL;
let ip = 0;
const post = (path: string, body: unknown) =>
  auth.handler(new Request(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip}` },
    body: JSON.stringify(body),
  }));
const signIn = (email: string, password: string) => post("/sign-in/email", { email, password });

test("the review address gets a password field, not a link; everyone else gets a link", async () => {
  const res = await post("/sign-in/magic-link", { email: " apple-review@EXAMPLE.test " });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ password: true });
  expect(sent).toEqual([]);
  const other = await post("/sign-in/magic-link", { email: "someone@example.test" });
  expect(await other.json()).not.toHaveProperty("password");
  expect(sent).toEqual(["someone@example.test"]);
});

test("only the review address signs in with a password, and only with REVIEW_PASSWORD", async () => {
  expect((await signIn("someone@example.test", "a long review password")).status).toBe(401);
  expect((await signIn("apple-review@example.test", "not it at all")).status).toBe(401);
  const ok = await signIn("Apple-Review@example.test", "a long review password");
  expect(ok.status).toBe(200);
  const cookie = ok.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  expect(session?.user.email).toBe("apple-review@example.test");
});

test("changing REVIEW_PASSWORD changes the password", async () => {
  REVIEW!.password = "the rotated password";
  expect((await signIn("apple-review@example.test", "a long review password")).status).toBe(401);
  expect((await signIn("apple-review@example.test", "the rotated password")).status).toBe(200);
});

test("nobody signs up, resets or changes a password", async () => {
  expect((await post("/sign-up/email", { email: "new@example.test", password: "a long password", name: "" })).status).toBe(404);
  expect((await post("/request-password-reset", { email: "apple-review@example.test" })).status).toBe(404);
  expect((await post("/reset-password", { token: "x", newPassword: "a long password" })).status).toBe(404);
  expect((await post("/change-password", { currentPassword: "x", newPassword: "a long password" })).status).toBe(404);
});

test("password tries are limited", async () => {
  let status = 0;
  for (let i = 0; i < 12 && status !== 429; i++) status = (await signIn("apple-review@example.test", "guess")).status;
  expect(status).toBe(429);
});
