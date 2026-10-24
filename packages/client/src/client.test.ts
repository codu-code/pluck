import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { codeFrom, createClient, createQueue, pkcePair, Refused, SignedOut, tokenRequest, Unreachable, type Queued } from "./index";

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

  test("the first pluck that cannot be sent stops the drain", async () => {
    const { q } = store();
    for (const u of ["a", "b", "c"]) await q.add({ url: `https://${u}.test` });
    let tries = 0;
    expect(await q.drain(async () => { tries++; throw new Unreachable("down"); })).toBe(3);
    expect(tries).toBe(1);
  });
});

test("token requests: offline or a 5xx is Unreachable, so nobody is signed out for being on a train", async () => {
  const offline = (async () => { throw new TypeError("offline"); }) as typeof fetch;
  await expect(tokenRequest("https://pluck.test", {}, offline)).rejects.toBeInstanceOf(Unreachable);
  await expect(tokenRequest("https://pluck.test", {}, (async () => json(503, {})) as typeof fetch)).rejects.toBeInstanceOf(Unreachable);
  expect(await tokenRequest("https://pluck.test", {}, (async () => json(400, { error: "invalid_grant" })) as typeof fetch)).toBeNull();
  expect(await tokenRequest("https://pluck.test", {}, (async () => json(200, { access_token: "a", refresh_token: "r", expires_in: 3600 })) as typeof fetch)).toMatchObject({ access: "a", refresh: "r" });
});
