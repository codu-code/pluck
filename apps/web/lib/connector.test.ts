import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createPluckServer } from "@pluck/mcp-server";
import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { connectorFor } from "./connector";
import { addHighlight, addTag, deleteItem, newList, pluckAny, readItem, readList, removeHighlight, setListVisibility, tagIdsFor, tagsOf, updateMe } from "./library";

const FIX = "http://127.0.0.1:4180";
const ALL = ["library:read", "library:write"];

// The connector exactly as an AI tool meets it, over an in-memory transport, against the real library.
async function connect(userId: string, scopes = ALL, lib = connectorFor(userId), onError?: (e: unknown, tool: string) => void) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createPluckServer(lib, { scopes, onError }).connect(serverSide);
  const client = new Client({ name: "test-ai", version: "1.0.0" });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0]!.text;
    if (!res.isError) return JSON.parse(text);
    return text.startsWith("{") ? { error: JSON.parse(text).error } : { error: { code: "invalid_input", message: text } }; // the SDK's own input check
  };
  return { client, call };
}

const note = async (userId: string, text: string) => (await pluckAny(userId, { text, kind: "note" })).results[0]!.item;

test("every tool is offered by scope; delete only with library:delete", async () => {
  const { a } = await twoUsers();
  const names = async (scopes: string[]) => (await (await connect(a, scopes)).client.listTools()).tools.map((t) => t.name).sort();
  expect(await names(ALL)).toEqual(
    ["batch_update", "create_list", "create_tag", "get_digest", "get_item", "get_list", "list_highlights", "list_items", "list_lists", "list_tags", "save_item", "search_items", "update_list"],
  );
  expect(await names(["library:read"])).not.toContain("save_item");
  expect(await names([...ALL, "library:delete"])).toContain("delete_item");
  for (const t of (await (await connect(a)).client.listTools()).tools) {
    expect(t.description!.split(". ").length, t.name).toBe(1); // one sentence
    expect(t.description, t.name).not.toMatch(/claude|chatgpt|openai|anthropic|cursor/i);
    expect(t.annotations?.openWorldHint, t.name).toBe(t.name === "save_item"); // the one tool that reaches outside: it fetches the link
  }
});

test("save_item plucks a link marked as from the AI, tags it and adds it to a list; saving again never duplicates", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const { tag } = await addTag(a, "Reading");
  const list = await newList(a, { name: "Sources" });
  const first = await call("save_item", { url: `${FIX}/news-1.html`, tagIds: [tag.id], listId: list.id, note: "for the essay" });
  expect(first.saved[0]).toMatchObject({ title: "Small teams ship when the list is short", tags: ["Reading"], created: true });
  expect(Object.keys(first.saved[0]).sort()).toEqual(["created", "excerpt", "id", "kind", "preview", "savedAt", "siteName", "tags", "title", "url"]);
  const item = await readItem(a, first.saved[0].id);
  expect(item.source).toBe("mcp");
  expect(item.aiTagIds).toEqual([tag.id]);
  expect((await readList(a, list.id)).entries).toHaveLength(1);
  const again = await call("save_item", { url: `${FIX}/news-1.html` });
  expect(again.saved[0]).toMatchObject({ id: item.id, created: false });

  const many = await call("save_item", { text: `two links ${FIX}/news-2.html and ${FIX}/blog-1.html.` });
  expect(many.saved).toHaveLength(2);
  const todo = await call("save_item", { text: "Ring the printer", kind: "todo", dueAt: "2026-11-01T09:00:00Z" });
  expect(todo.saved[0]).toMatchObject({ kind: "todo", url: null });
});

test("save_item checks the tags and the list first: an unknown one saves nothing, so a retry cannot duplicate", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const before = (await call("list_items", { status: "inbox" })).items.length;
  const badTag = await call("save_item", { text: "A note that must not land", tagIds: ["000000000000000000000000"] });
  expect(badTag.error.code).toBe("unknown_tags");
  const badList = await call("save_item", { text: "Nor this one", listId: "000000000000000000000000" });
  expect(badList.error.code).toBe("not_found");
  expect((await call("list_items", { status: "inbox" })).items).toHaveLength(before);
});

test("save_item reads tags as REST does: ids or names, and an unknown one is refused with the same nearest Tags", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const { tag } = await addTag(a, "Reading");
  const byName = await call("save_item", { text: "Tagged by name", kind: "note", tagIds: ["reading"] });
  expect(byName.saved[0].tags).toEqual(["Reading"]);
  const refused = await call("save_item", { text: "Must not land", kind: "note", tagIds: ["Readng"] });
  expect(refused.error).toMatchObject({ code: "unknown_tags", details: { unknown: ["Readng"], nearest: [{ id: tag.id, name: "Reading" }] } });
  await expect(tagIdsFor(a, ["Readng"])).rejects.toMatchObject(refused.error);
  expect((await call("list_items", { status: "inbox" })).items).toHaveLength(1);
});

test("an error that is not one of ours stays on our side: logged, and the AI tool gets a plain internal error", async () => {
  const { a } = await twoUsers();
  const seen: string[] = [];
  const lib = { ...connectorFor(a), tags: async () => { throw Object.assign(new Error("WriteConflict on collection tags"), { code: 112 }); } };
  const { call } = await connect(a, ALL, lib, (_e, tool) => seen.push(tool));
  const res = await call("list_tags");
  expect(res.error).toEqual({ code: "internal", message: "Something went wrong on Pluck's side." });
  expect(seen).toEqual(["list_tags"]);
});

test("search, browse and read: cards, full text paged, highlights and lists, and nothing from another person", async () => {
  const { a, b } = await twoUsers();
  const { call } = await connect(a);
  const { results } = await pluckAny(a, { url: `${FIX}/news-1.html` });
  const id = results[0]!.item.id;
  await note(b, "finishing problem, but mine");

  const found = await call("search_items", { query: "finishing problem" });
  expect(found.items.map((c: { id: string }) => c.id)).toEqual([id]);
  const inbox = await call("list_items", { status: "inbox" });
  expect(inbox.items).toHaveLength(1);
  const read = await call("get_item", { id });
  expect(read.text).toContain("finishing problem");
  expect(read).toMatchObject({ textCursor: null, highlights: [], lists: [] });

  const theirs = (await pluckAny(b, { text: "private", kind: "note" })).results[0]!.item.id;
  expect((await call("get_item", { id: theirs })).error.code).toBe("not_found");
});

test("list_highlights: what the person marked across the library with the Item to cite, by words, paged; never another person's or the bin's", async () => {
  const { a, b } = await twoUsers();
  const { call } = await connect(a);
  const link = async (userId: string, page: string) => (await pluckAny(userId, { url: `${FIX}/${page}.html` })).results[0]!.item;
  const mark = (userId: string, itemId: string, quote: string, note?: string) =>
    addHighlight(userId, { itemId, quote, note, selector: { textQuote: { exact: quote, prefix: "", suffix: "" }, textPosition: { start: 0, end: 0 } } });
  const one = await link(a, "news-1");
  const two = await link(a, "news-2");
  const binned = await link(a, "blog-1");
  await mark(a, one.id, "a quokka never frowns", "for the essay");
  const second = await mark(a, two.id, "short lists get finished");
  await mark(a, binned.id, "a quokka in the bin");
  await deleteItem(a, binned.id);
  await mark(b, (await link(b, "news-1")).id, "a quokka, but theirs");

  const all = await call("list_highlights");
  expect(all).toEqual({
    highlights: [
      { quote: "short lists get finished", note: null, highlightedAt: second.createdAt, item: { id: two.id, title: two.title, url: two.url, siteName: two.siteName } },
      { quote: "a quokka never frowns", note: "for the essay", highlightedAt: expect.any(String), item: { id: one.id, title: one.title, url: one.url, siteName: one.siteName } },
    ],
    nextCursor: null,
  });
  expect((await call("list_highlights", { query: "QUOKKA" })).highlights.map((h: { quote: string }) => h.quote)).toEqual(["a quokka never frowns"]);
  expect((await call("list_highlights", { query: "essay" })).highlights).toHaveLength(1); // the person's note counts
  expect((await call("list_highlights", { itemId: two.id })).highlights).toHaveLength(1);
  expect((await call("list_highlights", { since: second.createdAt })).highlights).toHaveLength(1);

  const first = await call("list_highlights", { limit: 1 });
  expect(first.highlights).toHaveLength(1);
  const rest = await call("list_highlights", { limit: 1, cursor: first.nextCursor });
  expect(rest.highlights[0].quote).toBe("a quokka never frowns");
  expect(rest.nextCursor).toBeNull();
  expect((await call("list_highlights", { cursor: "made-up" })).error.code).toBe("bad_request");

  // Long quotes: a page stops at the response cap, and its cursor carries on from the row it stopped at.
  for (let i = 0; i < 8; i++) await mark(a, one.id, `long ${i} ${"word ".repeat(990)}`);
  const capped = await call("list_highlights");
  expect(JSON.stringify(capped).length).toBeLessThan(33_000);
  expect(capped.highlights.length).toBeLessThan(8);
  const after = await call("list_highlights", { cursor: capped.nextCursor });
  expect([...capped.highlights, ...after.highlights].map((h: { quote: string }) => h.quote.slice(0, 6))).toEqual(["long 7", "long 6", "long 5", "long 4", "long 3", "long 2", "long 1", "long 0", "short ", "a quok"]);
  expect(after.nextCursor).toBeNull();
});

test("search_items finds an Item by what was highlighted in it, until the highlight is removed", async () => {
  const { a, b } = await twoUsers();
  const { call } = await connect(a);
  const id = (await pluckAny(a, { url: `${FIX}/news-1.html` })).results[0]!.item.id;
  await pluckAny(b, { url: `${FIX}/news-1.html` });
  const quote = "an axolotl of a sentence";
  const h = await addHighlight(a, { itemId: id, quote, selector: { textQuote: { exact: quote, prefix: "", suffix: "" }, textPosition: { start: 0, end: 0 } } });
  expect((await call("search_items", { query: "axolotl" })).items.map((c: { id: string }) => c.id)).toEqual([id]);
  expect((await (await connect(b)).call("search_items", { query: "axolotl" })).items).toEqual([]);
  await removeHighlight(a, h.id);
  expect((await call("search_items", { query: "axolotl" })).items).toEqual([]);
});

test("get_item pages long text with an opaque cursor", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const body = Array.from({ length: 2000 }, (_, i) => `Line ${i} ${"word ".repeat(10)}`).join("\n");
  const item = await note(a, body);
  const first = await call("get_item", { id: item.id, include: ["text"] });
  expect(first.textCursor).toBeTruthy();
  const second = await call("get_item", { id: item.id, cursor: first.textCursor });
  expect(first.text + second.text).toBe(body);
  expect(second).toMatchObject({ id: item.id, textCursor: null }); // the same name on every page
  expect((await call("get_item", { id: item.id, cursor: "made-up" })).error.code).toBe("bad_request");
});

test("batch_update tags with existing tags only, and an unknown tag gets the nearest instead of a new one", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const { tag } = await addTag(a, "Design");
  const x = await note(a, "one");
  const y = await note(a, "two");
  expect(await call("batch_update", { itemIds: [x.id, y.id], patch: { addTagIds: [tag.id], status: "later" } })).toEqual({ matched: 2, updated: 2 });
  expect((await readItem(a, x.id)).status).toBe("later");
  const refused = await call("batch_update", { itemIds: [x.id], patch: { addTagIds: ["Desing"] } });
  expect(refused.error).toMatchObject({ code: "unknown_tags", details: { unknown: ["Desing"], nearest: [{ id: tag.id, name: "Design" }] } });
  expect((await tagsOf(a)).map((t) => t.name)).toEqual(["Design"]);
});

test("tags: list with counts, and create_tag is marked as made by AI", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const made = await call("create_tag", { name: "Essays" });
  expect(made.created).toBe(true);
  expect((await call("list_tags")).tags).toEqual([{ id: made.tag.id, name: "Essays", count: 0, madeByAi: true }]);
});

test("create_list is private with AI notes; update_list changes everything but the purpose, and public needs the person", async () => {
  const { a } = await twoUsers();
  const { call } = await connect(a);
  const [x, y, z] = [await note(a, "x"), await note(a, "y"), await note(a, "z")];
  const { list } = await call("create_list", { name: "Reading", purpose: "For the talk", items: [{ itemId: x.id, note: "start here" }, { itemId: y.id }] });
  expect(list).toMatchObject({ visibility: "private", itemCount: 2, purpose: "For the talk" });
  const got = await call("get_list", { id: list.id });
  expect(got.entries.map((e: { id: string; note: string | null; noteBy: string | null }) => [e.id, e.note, e.noteBy])).toEqual([[x.id, "start here", "ai"], [y.id, null, null]]);
  expect((await readList(a, list.id)).list.createdBy).toBe("mcp");

  await call("update_list", { id: list.id, name: "Talk reading", add: [{ itemId: z.id, note: "last" }], remove: [y.id], entries: [{ itemId: x.id, ticked: true }], order: [z.id, x.id] });
  const after = await readList(a, list.id);
  expect(after.list.name).toBe("Talk reading");
  expect(after.entries.map((e) => [e.item.id, e.ticked])).toEqual([[z.id, false], [x.id, true]]);
  expect((await call("get_list", { id: list.id, open: true })).entries.map((e: { id: string }) => e.id)).toEqual([z.id]); // what is left

  const purpose = await call("update_list", { id: list.id, purpose: "Something else" });
  expect(purpose.error.code).toBe("invalid_input");
  expect((await readList(a, list.id)).list.purpose).toBe("For the talk");

  await updateMe(a, { handle: `ai-${Date.now().toString(36)}` });
  expect((await call("update_list", { id: list.id, visibility: "public" })).error.code).toBe("forbidden");
  expect((await call("update_list", { id: list.id, visibility: "public", personAskedForPublic: true })).error.code).toBe("invalid_input");
  expect((await readList(a, list.id)).list.visibility).toBe("private");
  expect((await call("update_list", { id: list.id, visibility: "private" })).list.visibility).toBe("private");
  expect((await call("list_lists")).lists.map((l: { id: string }) => l.id)).toEqual([list.id]);
});

test("the connector has no way to make a list public, even when the person could", async () => {
  const { a } = await twoUsers();
  await updateMe(a, { handle: `ai-${Date.now().toString(36)}` });
  const list = await newList(a, { name: "Mine" });
  await setListVisibility(a, list.id, "public");
  const lib = connectorFor(a);
  expect(Object.keys(lib).filter((k) => /visib|public|share/i.test(k))).toEqual([]);
  // A caller that ignores the types still cannot pass "public" through.
  await (lib.makePrivate as (...args: unknown[]) => Promise<void>)(list.id, "public");
  expect((await readList(a, list.id)).list.visibility).toBe("private");
});

test("another person's list is not found, and nothing is changed", async () => {
  const { a, b } = await twoUsers();
  const { call } = await connect(a);
  const theirs = await newList(b, { name: "Mine" });
  expect((await call("get_list", { id: theirs.id })).error.code).toBe("not_found");
  expect((await call("update_list", { id: theirs.id, name: "Taken" })).error.code).toBe("not_found");
  await setListVisibility(b, theirs.id, "private");
  expect((await readList(b, theirs.id)).list.name).toBe("Mine");
});

test("get_digest, delete_item to the bin, the two resources and the four prompts", async () => {
  const { a } = await twoUsers();
  const item = await note(a, "the body of the note");
  const list = await newList(a, { name: "Notes", purpose: "kept", items: [{ itemId: item.id, note: "why" }] });
  const { client, call } = await connect(a, [...ALL, "library:delete"]);

  expect(await call("get_digest", { limit: 3 })).toHaveProperty("oldest");
  const itemDoc = await client.readResource({ uri: `item://${item.id}` });
  expect((itemDoc.contents[0] as { text: string }).text).toContain("the body of the note");
  const listDoc = await client.readResource({ uri: `list://${list.id}` });
  expect((listDoc.contents[0] as { text: string }).text).toMatch(/# Notes\n\nkept\n\n1\. .*\n {3}why/);
  expect((await client.listResources()).resources.map((r) => r.uri)).toEqual([`list://${list.id}`]);

  const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort();
  expect(prompts).toEqual(["build_list", "content_ideas", "tidy_inbox", "weekly_review"]);
  for (const name of prompts) {
    const p = await client.getPrompt({ name, arguments: name === "content_ideas" ? { topic: "small teams" } : {} });
    expect((p.messages[0]!.content as { text: string }).text.length).toBeGreaterThan(100);
    if (name === "content_ideas") expect((p.messages[0]!.content as { text: string }).text).toContain("list_highlights");
  }

  expect(await call("delete_item", { id: item.id })).toEqual({ binned: item.id });
  expect((await call("get_item", { id: item.id })).error.code).toBe("not_found");
});

test("each tool call and prompt is reported by name and outcome, never with its arguments", async () => {
  const { a } = await twoUsers();
  const calls: unknown[] = [];
  const prompts: string[] = [];
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createPluckServer(connectorFor(a), { scopes: ALL, onCall: (c) => calls.push(c), onPrompt: (p) => prompts.push(p) }).connect(serverSide);
  const client = new Client({ name: "test-ai", version: "1.0.0" });
  await client.connect(clientSide);
  await note(a, "secret words");
  await client.callTool({ name: "list_items", arguments: {} });
  await client.callTool({ name: "get_item", arguments: { id: "000000000000000000000000" } });
  await client.getPrompt({ name: "tidy_inbox" });
  expect(calls).toEqual([
    { tool: "list_items", ok: true, errorCode: null, resultCount: 1, ms: expect.any(Number) },
    { tool: "get_item", ok: false, errorCode: "not_found", resultCount: null, ms: expect.any(Number) },
  ]);
  expect(prompts).toEqual(["tidy_inbox"]);
});
