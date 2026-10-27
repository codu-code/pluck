import { describe, expect, test } from "vitest";
import { createLibrary, Refused, sameOrigin, SignedOut, Unreachable, type Library } from "./index";

const A = "a".repeat(24), B = "b".repeat(24), L = "c".repeat(24), T = "d".repeat(24);
const item = (id: string, tagIds: string[] = []) => ({ id, tagIds });

// A fake server: records each request and answers from `reply` (by "METHOD path"), 204 otherwise.
function fake(reply: Record<string, [number, unknown]> = {}) {
  const sent: string[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const key = `${init.method} ${url}`;
    sent.push(init.body === undefined ? key : `${key} ${init.body as string}`);
    const [status, body] = reply[key] ?? [204, null];
    return new Response(body === null ? null : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { sent, library: createLibrary(sameOrigin(f)) };
}

// Each action, the requests it makes, and what it returns.
const cases: [string, (l: Library) => Promise<unknown>, string[], Record<string, [number, unknown]>?, unknown?][] = [
  ["move one", (l) => l.move([A], "later"), [`PATCH /api/v1/items/${A} {"status":"later"}`]],
  ["move many", (l) => l.move([A, B], "archived"), [`POST /api/v1/items/batch {"itemIds":["${A}","${B}"],"patch":{"status":"archived"}}`]],
  ["restore, one call per Status", (l) => l.restore([{ id: A, status: "inbox" }, { id: B, status: "later" }]),
    [`PATCH /api/v1/items/${A} {"status":"inbox"}`, `PATCH /api/v1/items/${B} {"status":"later"}`]],
  ["edit", (l) => l.edit(A, { title: "Hi" }), [`PATCH /api/v1/items/${A} {"title":"Hi"}`], { [`PATCH /api/v1/items/${A}`]: [200, { item: { id: A } }] }, { id: A }],
  ["remove", (l) => l.remove(A), [`DELETE /api/v1/items/${A}`]],
  ["fromBin", (l) => l.fromBin(A), [`POST /api/v1/items/${A}/restore`]],
  ["forever", (l) => l.forever(A), [`DELETE /api/v1/items/${A}/forever`]],
  ["tags", (l) => l.tags(), ["GET /api/v1/tags"], { "GET /api/v1/tags": [200, { tags: [{ id: T }] }] }, [{ id: T }]],
  ["newTag", (l) => l.newTag("x"), [`POST /api/v1/tags {"name":"x"}`], { "POST /api/v1/tags": [201, { tag: { id: T } }] }, { id: T }],
  ["renameTag", (l) => l.renameTag(T, "y"), [`PATCH /api/v1/tags/${T} {"name":"y"}`]],
  ["deleteTag off every Item", (l) => l.deleteTag(T), [`DELETE /api/v1/tags/${T}?removeFromItems=true`]],
  ["deleteTag into another", (l) => l.deleteTag(T, B), [`DELETE /api/v1/tags/${T}?reassignTo=${B}`]],
  ["setTag on one: its whole new set", (l) => l.setTag([A], T, true, [item(A, [B])]), [`PATCH /api/v1/items/${A} {"tagIds":["${B}","${T}"]}`],
    { [`PATCH /api/v1/items/${A}`]: [200, { item: { id: A, tagIds: [B, T] } }] }, [{ id: A, tagIds: [B, T] }]],
  ["setTag off many: one batch, applied here", (l) => l.setTag([A, B], T, false, [item(A, [T]), item(B, [T, A])]),
    [`POST /api/v1/items/batch {"itemIds":["${A}","${B}"],"patch":{"removeTagIds":["${T}"]}}`], {}, [item(A), item(B, [A])]],
  ["lists", (l) => l.lists(), ["GET /api/v1/lists"], { "GET /api/v1/lists": [200, { lists: [] }] }, []],
  ["memberships", (l) => l.memberships(A), [`GET /api/v1/items/${A}?include=lists`], { [`GET /api/v1/items/${A}?include=lists`]: [200, { lists: [] }] }, []],
  ["newList", (l) => l.newList("Trip"), [`POST /api/v1/lists {"name":"Trip"}`], { "POST /api/v1/lists": [201, { list: { id: L } }] }, { id: L }],
  ["newList with Items", (l) => l.newList("Trip", [A]), [`POST /api/v1/lists {"name":"Trip","items":[{"itemId":"${A}"}]}`], { "POST /api/v1/lists": [201, { list: { id: L } }] }, { id: L }],
  ["setInList on", (l) => l.setInList([A, B], L, true), [`POST /api/v1/lists/${L}/items {"itemIds":["${A}","${B}"]}`]],
  ["setInList off, one each", (l) => l.setInList([A, B], L, false), [`DELETE /api/v1/lists/${L}/items/${A}`, `DELETE /api/v1/lists/${L}/items/${B}`]],
  ["mark one", (l) => l.mark(L, [A], true), [`PATCH /api/v1/lists/${L}/items/${A} {"ticked":true}`]],
  ["mark many", (l) => l.mark(L, [A, B], false), [`PATCH /api/v1/lists/${L}/items {"itemIds":["${A}","${B}"],"ticked":false}`]],
  ["reorder", (l) => l.reorder(L, [B, A]), [`POST /api/v1/lists/${L}/reorder {"itemIds":["${B}","${A}"]}`]],
  ["putBack: in place with its note, marked again", (l) => l.putBack(L, [{ item: { id: A }, position: 1024, note: "n", ticked: true }, { item: { id: B }, position: 2048, note: null, ticked: false }]), [
    `POST /api/v1/lists/${L}/items {"itemId":"${A}","position":1024,"note":"n"}`,
    `POST /api/v1/lists/${L}/items {"itemId":"${B}","position":2048,"note":null}`,
    `PATCH /api/v1/lists/${L}/items {"itemIds":["${A}"],"ticked":true}`,
  ]],
];

describe("the library actions", () => {
  test.each(cases)("%s", async (_, act, sent, reply = {}, returns = undefined) => {
    const s = fake(reply);
    const out = await act(s.library);
    expect(s.sent).toEqual(sent);
    if (returns !== undefined) expect(out).toEqual(returns);
  });

  test("errors come back as the client maps them", async () => {
    const say = (status: number, body: unknown = {}) => fake({ [`PATCH /api/v1/items/${A}`]: [status, body] }).library.move([A], "later");
    await expect(say(422, { error: { code: "not_a_task", message: "Only a Todo or a Thing is Done." } })).rejects.toMatchObject({ code: "not_a_task", status: 422 });
    await expect(say(401)).rejects.toBeInstanceOf(SignedOut);
    await expect(say(503)).rejects.toBeInstanceOf(Unreachable);
    await expect(createLibrary(sameOrigin((async () => { throw new TypeError("offline"); }) as typeof fetch)).move([A], "later")).rejects.toBeInstanceOf(Unreachable);
  });

  test("taking an Item out of a List it is not in counts as done; any other refusal does not", async () => {
    await expect(fake({ [`DELETE /api/v1/lists/${L}/items/${A}`]: [404, {}] }).library.setInList([A], L, false)).resolves.toBeUndefined();
    await expect(fake({ [`DELETE /api/v1/lists/${L}/items/${A}`]: [403, {}] }).library.setInList([A], L, false)).rejects.toBeInstanceOf(Refused);
  });
});
