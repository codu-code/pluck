import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { auth, signInCode } from "@/lib/auth";
import { newKey, newList, readList, updateMe } from "@/lib/library";
import { DELETE as deleteHighlight } from "../../highlights/[id]/route";
import { DELETE as deleteTag } from "../../tags/[id]/route";
import { POST as share } from "./people/route";
import { DELETE as deleteList, PATCH as patchList } from "./route";

test("deleting a List, a Tag or a highlight needs library:delete, like deleting an Item", async () => {
  const { a } = await twoUsers();
  const { key } = await newKey(a, "script"); // read and write, the default
  const { key: deleter } = await newKey(a, "cleanup", ["library:read", "library:write", "library:delete"]);
  const list = await newList(a, { name: "Keep me" });
  const call = (handler: typeof deleteList, url: string, id: string, bearer: string) =>
    handler(new Request(url, { method: "DELETE", headers: { authorization: `Bearer ${bearer}` } }), { params: Promise.resolve({ id }) });

  const id = "0".repeat(24); // refused before anything is looked up
  for (const [handler, path] of [[deleteList, "lists"], [deleteTag, "tags"], [deleteHighlight, "highlights"]] as const)
    expect((await call(handler, `http://x/api/v1/${path}/${id}`, id, key)).status).toBe(403);
  expect((await call(deleteList, `http://x/api/v1/lists/${list.id}`, list.id, key)).status).toBe(403);
  expect((await call(deleteList, `http://x/api/v1/lists/${list.id}`, list.id, deleter)).status).toBe(204);
});

test("making a List public or sharing it with people takes the person, not an API key", async () => {
  const email = `owner-${Date.now()}@example.test`;
  const signedIn = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/email-otp`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, otp: await signInCode(email) }),
  }));
  const me = ((await signedIn.json()) as { user: { id: string } }).user.id;
  const cookie = signedIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  await updateMe(me, { handle: `owner${Date.now()}` });
  const { key } = await newKey(me, "script", ["library:read", "library:write", "library:delete"]);
  const list = await newList(me, { name: "Trip" });
  const as = (headers: Record<string, string>) => ({
    patch: (visibility: string) =>
      patchList(new Request(`http://x/api/v1/lists/${list.id}`, { method: "PATCH", headers, body: JSON.stringify({ name: "Renamed", visibility }) }), { params: Promise.resolve({ id: list.id }) }),
    share: () =>
      share(new Request(`http://x/api/v1/lists/${list.id}/people`, { method: "POST", headers, body: JSON.stringify({ email: "friend@example.test" }) }), { params: Promise.resolve({ id: list.id }) }),
  });
  const withKey = as({ authorization: `Bearer ${key}` }), inBrowser = as({ cookie });

  expect((await withKey.patch("public")).status).toBe(403);
  expect((await withKey.share()).status).toBe(403);
  expect((await readList(me, list.id)).list).toMatchObject({ name: "Trip", visibility: "private" }); // refused whole: not renamed either
  expect((await inBrowser.patch("public")).status).toBe(200);
  expect((await inBrowser.share()).status).toBe(201);
  expect((await withKey.patch("private")).status).toBe(200); // taking it back down is a plain write
});
