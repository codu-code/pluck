import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { createClient, Refused, SignedOut, Unreachable } from "./api";
import { marks, parseMarkdown } from "./markdown";
import { codeFrom, pkcePair } from "./pkce";
import { createQueue, type Queued } from "./queue";

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

test("markdown becomes blocks, and highlights split the text they appear in", () => {
  const blocks = parseMarkdown("# Title\n\nFirst **bold** line\ncontinues [link](https://x.test).\n\n- one\n2. two\n\n> quoted\n\n```\ncode\n```");
  expect(blocks).toEqual([
    { type: "heading", level: 1, text: "Title" },
    { type: "paragraph", text: "First bold line continues link." },
    { type: "item", text: "one", ordered: false },
    { type: "item", text: "two", ordered: true },
    { type: "quote", text: "quoted" },
    { type: "code", text: "code" },
  ]);
  expect(marks("The scope is the contract. Refresh is next.", ["scope is the contract"])).toEqual([
    { text: "The ", mark: false }, { text: "scope is the contract", mark: true }, { text: ". Refresh is next.", mark: false },
  ]);
});
