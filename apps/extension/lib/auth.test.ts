import { beforeEach, expect, test, vi } from "vitest";

// storage.local as a plain object, and a server where each key is a person.
const local = vi.hoisted(() => {
  const local: Record<string, unknown> = {};
  Object.assign(globalThis, {
    __DEFAULT_SERVER__: "https://pluck.test",
    browser: { storage: { local: { get: async (k: string) => ({ [k]: local[k] }), set: async (patch: object) => void Object.assign(local, patch) } } },
  });
  return local;
});
import { refused, signOut, useApiKey } from "./auth";

const waiting = [{ id: "q1", body: { url: "https://a.test", html: "<p>the whole page</p>" }, at: 1 }];
beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const id = (init.headers as Record<string, string>).authorization!.replace("Bearer pk_live_", "");
    return Response.json({ me: { id, email: `${id}@example.test` } });
  });
});

test("a queue outlives a refused token only for the person it belongs to", async () => {
  expect(await useApiKey("pk_live_u1")).toBe(true);
  Object.assign(local, { queue: waiting });
  await refused(); // the server signed them out: the queue waits
  expect(local).toMatchObject({ queue: waiting, owner: "u1", email: null });
  await useApiKey("pk_live_u1"); // back as themselves
  expect(local.queue).toEqual(waiting);
  await refused();
  await useApiKey("pk_live_u2"); // someone else on this browser
  expect(local).toMatchObject({ queue: [], owner: "u2", apiKey: "pk_live_u2" });
});

test("signing out by hand, as a change of server does, leaves nothing waiting", async () => {
  await useApiKey("pk_live_u1");
  Object.assign(local, { queue: waiting });
  await signOut();
  expect(local).toMatchObject({ queue: [], owner: null, apiKey: null });
});
