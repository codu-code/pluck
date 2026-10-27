import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { codeFrom, createClient, createQueue, createSession, pkcePair, Refused, SignedOut, tokenRequest, Unreachable, type Queued, type SessionStore, type Stored } from "./index";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the API client", () => {
  const deps = (f: typeof fetch, auth: string | null = "Bearer t") => ({
    server: async () => "https://pluck.test", auth: async () => auth, onSignedOut: vi.fn(async () => {}), fetch: f,
  });

  test("sends the token and the body, and returns the JSON", async () => {
    const f = vi.fn(async () => json(201, { results: [] }));
    const api = createClient(deps(f as unknown as typeof fetch));
    expect(await api("/api/v1/items", { json: { url: "https://x.test" } })).toEqual({ results: [] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://pluck.test/api/v1/items");
    expect(init).toMatchObject({ method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" } });
  });

  test("maps failures: network and 5xx wait, 401 signs out, 4xx is refused with the server's words", async () => {
    await expect(createClient(deps((async () => { throw new TypeError("offline"); }) as typeof fetch))("/x")).rejects.toBeInstanceOf(Unreachable);
    await expect(createClient(deps((async () => json(503, {})) as typeof fetch))("/x")).rejects.toBeInstanceOf(Unreachable);
    const d = deps((async () => json(401, {})) as typeof fetch);
    await expect(createClient(d)("/x")).rejects.toBeInstanceOf(SignedOut);
    expect(d.onSignedOut).toHaveBeenCalled();
    const refused = createClient(deps((async () => json(422, { error: { code: "unknown_tags", message: "No such tag." } })) as typeof fetch))("/x");
    await expect(refused).rejects.toMatchObject({ code: "unknown_tags", message: "No such tag.", status: 422 });
    await expect(createClient(deps((async () => json(200, {})) as typeof fetch, null))("/x")).rejects.toBeInstanceOf(SignedOut);
  });
});

test("the offline queue keeps order, drops what the server refuses, keeps what could not be sent", async () => {
  let saved: Queued[] = [];
  const q = createQueue({ read: async () => saved, write: async (x) => { saved = x; } });
  await q.add({ url: "https://a.test" });
  await q.add({ url: "https://b.test" });
  expect(await q.add({ url: "https://c.test" })).toBe(3);
  const sent: string[] = [];
  const left = await q.drain(async (b) => {
    if (b.url === "https://b.test") throw new Refused("bad_request", "no", 400);
    if (b.url === "https://c.test") throw new Unreachable("down");
    sent.push(b.url!);
  });
  expect(sent).toEqual(["https://a.test"]);
  expect(left).toBe(1);
  expect(saved.map((s) => s.body.url)).toEqual(["https://c.test"]);
});

test("PKCE: S256 challenge of the verifier, and only a matching state yields the code", async () => {
  const { verifier, challenge, state } = await pkcePair((n) => new Uint8Array(randomBytes(n)), async (s) => new Uint8Array(createHash("sha256").update(s).digest()));
  expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  expect(codeFrom(`io.getpluck.app:/oauth?code=abc&state=${state}`, state)).toBe("abc");
  expect(codeFrom("io.getpluck.app:/oauth?code=abc&state=other", state)).toBeNull();
});

describe("the offline queue under load", () => {
  const store = () => {
    const box = { saved: [] as Queued[] };
    return { box, q: createQueue({ read: async () => structuredClone(box.saved), write: async (x) => void (box.saved = structuredClone(x)) }) };
  };

  test("a pluck queued while a drain runs is kept", async () => {
    const { box, q } = store();
    await q.add({ url: "https://a.test" });
    await q.drain(async () => void (await q.add({ url: "https://late.test" })));
    expect(box.saved.map((s) => s.body.url)).toEqual(["https://late.test"]);
  });

  test("two drains at once send each note once", async () => {
    const { q } = store();
    await q.add({ text: "a note" });
    await q.add({ text: "another" });
    const sent: string[] = [];
    const send = async (b: { text?: string }) => void sent.push(b.text!);
    expect(await Promise.all([q.drain(send), q.drain(send)])).toEqual([0, 0]);
    expect(sent).toEqual(["a note", "another"]);
  });

  test.each([
    ["signed out", new SignedOut("sign in")],
    ["offline or down", new Unreachable("down")],
    ["anything else unexpected", new TypeError("fetch failed")],
  ])("%s: the pluck is kept, with its key, for next time", async (_, error) => {
    const { box, q } = store();
    await q.add({ text: "a note" }, "draft-1");
    const keys: (string | undefined)[] = [];
    expect(await q.drain(async (b) => { keys.push(b.clientKey); throw error; })).toBe(1);
    expect(box.saved).toMatchObject([{ id: "draft-1", body: { text: "a note" } }]);
    await q.drain(async (b) => void keys.push(b.clientKey));
    expect(keys).toEqual(["draft-1", "draft-1"]); // the same key every time, so a resend makes no second Note
    expect(box.saved).toEqual([]);
  });

  test("the first pluck that cannot be sent stops the drain", async () => {
    const { q } = store();
    for (const u of ["a", "b", "c"]) await q.add({ url: `https://${u}.test` });
    let tries = 0;
    expect(await q.drain(async () => { tries++; throw new Unreachable("down"); })).toBe(3);
    expect(tries).toBe(1);
  });
});

test("a token request that hangs gives up as Unreachable, so screens waiting on it are not held", async () => {
  const hangs = ((_: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError"))))) as typeof fetch;
  await expect(tokenRequest("https://pluck.test", {}, hangs, 50)).rejects.toBeInstanceOf(Unreachable);
});

test("token requests: offline or a 5xx is Unreachable, so nobody is signed out for being on a train", async () => {
  const offline = (async () => { throw new TypeError("offline"); }) as typeof fetch;
  await expect(tokenRequest("https://pluck.test", {}, offline)).rejects.toBeInstanceOf(Unreachable);
  await expect(tokenRequest("https://pluck.test", {}, (async () => json(503, {})) as typeof fetch)).rejects.toBeInstanceOf(Unreachable);
  expect(await tokenRequest("https://pluck.test", {}, (async () => json(400, { error: "invalid_grant" })) as typeof fetch)).toBeNull();
  expect(await tokenRequest("https://pluck.test", {}, (async () => json(200, { access_token: "a", refresh_token: "r", expires_in: 3600 })) as typeof fetch)).toMatchObject({ access: "a", refresh: "r" });
});

describe("the session", () => {
  // The token endpoint as Better Auth runs it: a refresh token works once, and of two refreshes at once one wins and
  // the other gets invalid_grant (a retry within 30 seconds of the win would be replayed the same pair; one in flight is not).
  const tokenServer = () => {
    let n = 0;
    const live = new Set(["r0"]);
    const spend = (r: string) => (live.delete(r) ? (live.add(`r${++n}`), { access: `a${n}`, refresh: `r${n}` }) : null);
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      const pair = spend(new URLSearchParams(String(init?.body)).get("refresh_token")!);
      await new Promise((r) => setTimeout(r, 5)); // both requests are on the wire before either answers
      return pair ? json(200, { access_token: pair.access, refresh_token: pair.refresh, expires_in: 3600 }) : json(400, { error: "invalid_grant" });
    });
    return { f, spend, fetch: f as unknown as typeof fetch };
  };
  const expired = { access: "a0", refresh: "r0", expiresAt: Date.now() - 1 };
  const memory = (lock?: SessionStore["lock"]) => {
    const box: { s: Stored } = { s: { server: "https://pluck.test", clientId: "c", tokens: expired } };
    const store: SessionStore = { read: async () => structuredClone(box.s), write: async (tokens) => void (box.s = { ...box.s, tokens }), lock };
    return { box, store };
  };
  // A Web Lock: one holder at a time across every context of the extension.
  const webLock = () => {
    let held: Promise<unknown> = Promise.resolve();
    return <T>(fn: () => Promise<T>) => {
      const run = held.then(fn);
      held = run.catch(() => {});
      return run;
    };
  };

  test("the popup and the background refreshing at once both stay signed in, spending the refresh token once", async () => {
    const server = tokenServer();
    const { box, store } = memory(webLock());
    const popup = createSession(store, server.fetch), background = createSession(store, server.fetch);
    expect(await Promise.all([popup.authHeader(), background.authHeader()])).toEqual(["Bearer a1", "Bearer a1"]);
    expect(box.s.tokens).toMatchObject({ access: "a1", refresh: "r1" });
    expect(server.f).toHaveBeenCalledTimes(1);
  });

  test("a refresh refused because another app (the share extension) spent the token first keeps that app's tokens", async () => {
    const server = tokenServer();
    const { box, store } = memory();
    server.f.mockImplementationOnce(async () => {
      const pair = server.spend("r0")!; // the share extension refreshed and wrote the Keychain while we were asking
      box.s = { ...box.s, tokens: { ...pair, expiresAt: Date.now() + 3600_000 } };
      return json(400, { error: "invalid_grant" });
    });
    expect(await createSession(store, server.fetch).authHeader()).toBe("Bearer a1");
    expect(box.s.tokens).toMatchObject({ refresh: "r1" });
  });

  test("a refresh token the server refuses signs out; offline keeps the tokens", async () => {
    const { box, store } = memory();
    expect(await createSession(store, (async () => json(400, { error: "invalid_grant" })) as typeof fetch).authHeader()).toBeNull();
    expect(box.s.tokens).toBeNull();
    box.s.tokens = expired;
    await expect(createSession(store, (async () => { throw new TypeError("offline"); }) as typeof fetch).authHeader()).rejects.toBeInstanceOf(Unreachable);
    expect(box.s.tokens).toEqual(expired);
  });
});
