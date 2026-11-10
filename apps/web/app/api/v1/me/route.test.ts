import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { auth, signInCode } from "@/lib/auth";
import { me as readMe, newKey } from "@/lib/library";
import { POST as newAddress } from "../email-in/regenerate/route";
import { PATCH } from "./route";

const patch = (headers: Record<string, string>, body: object) => PATCH(new Request("http://x/api/v1/me", { method: "PATCH", headers, body: JSON.stringify(body) }), { params: Promise.resolve({}) });

test("an API key can change the name and settings, but not the handle or the email-in address", async () => {
  const { a } = await twoUsers();
  const { key } = await newKey(a, "script", ["library:read", "library:write", "library:delete"]);
  const withKey = { authorization: `Bearer ${key}` };
  expect((await patch(withKey, { name: "Ana" })).status).toBe(200);
  const before = (await readMe(a)).handle;
  expect((await patch(withKey, { handle: `taken${Date.now()}` })).status).toBe(403);
  expect((await readMe(a)).handle).toBe(before);
  expect((await newAddress(new Request("http://x/api/v1/email-in/regenerate", { method: "POST", headers: withKey }), { params: Promise.resolve({}) })).status).toBe(403);
});

test("the person, in their browser, changes their handle and their email-in address", async () => {
  const email = `owner-${Date.now()}@example.test`;
  const signedIn = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/email-otp`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, otp: await signInCode(email) }),
  }));
  const cookie = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const handle = `owner${Date.now()}`;
  const res = await patch({ cookie }, { handle });
  expect(res.status).toBe(200);
  expect(((await res.json()) as { me: { handle: string } }).me.handle).toBe(handle);
  expect((await newAddress(new Request("http://x/api/v1/email-in/regenerate", { method: "POST", headers: { cookie } }), { params: Promise.resolve({}) })).status).toBe(200);
});
