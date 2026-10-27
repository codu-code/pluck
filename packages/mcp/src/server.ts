import { McpServer, ResourceTemplate, type CallToolResult } from "@modelcontextprotocol/server";
import { DueAt, ErrorCode, Kind, ObjectIdString, Status, type Item, type ListEntry, type ListMembership } from "@pluck/shared-schemas";
import { z } from "zod";
import type { PluckLibrary } from "./library";
import { registerPrompts } from "./prompts";
import { card, fit, readOffset, TEXT_PAGE_CHARS, tagNameMap, textPage } from "./shape";

export type ServerOptions = {
  scopes: string[]; // library:read, library:write, library:delete; a tool is only offered when its scope was granted
  version?: string;
  onError?: (error: unknown, tool: string) => void;
};

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }] });

// The library's errors ({ code, message, details }) go back to the AI tool as they are, so it can correct itself.
// Only our own codes: a database or runtime error also has a code and a message, and those stay on our side, logged.
function failed(e: unknown): CallToolResult | null {
  if (!e || typeof e !== "object" || !("code" in e) || !("message" in e) || !ErrorCode.safeParse(e.code).success) return null;
  const { code, message, details } = e as { code: string; message: string; details?: unknown };
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code, message, ...(details === undefined ? {} : { details }) } }) }] };
}

export function createPluckServer(lib: PluckLibrary, { scopes, version = "1.0.0", onError }: ServerOptions): McpServer {
  const server = new McpServer(
    { name: "pluck", title: "Pluck", version },
    { instructions: "Pluck is the person's own library of saved links, notes and lists. Organise only with their yes: propose first, then apply. Use their existing tags; make a new tag only when they agree to it." },
  );
  const can = (scope: string) => scopes.includes(scope);

  function tool<S extends z.ZodType>(
    name: string,
    config: { description: string; inputSchema: S; annotations: object },
    run: (args: z.infer<S>) => Promise<unknown>,
  ) {
    server.registerTool(name, config, (async (args: z.infer<S>) => {
      try {
        return ok(await run(args));
      } catch (e) {
        const result = failed(e);
        if (result) return result;
        onError?.(e, name);
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code: "internal", message: "Something went wrong on Pluck's side." } }) }] };
      }
    }) as never);
  }

  const names = async () => tagNameMap(await lib.tags());
  const cards = async (items: Item[]) => {
    const n = await names();
    return items.map((i) => card(i, n));
  };
  const entryRow = (e: ListEntry, n: Map<string, string>) => ({ ...card(e.item, n), note: e.note, noteBy: e.noteBy === "mcp" ? "ai" : e.noteBy, ticked: e.ticked });
  const membershipRow = (m: ListMembership) => ({ listId: m.list.id, name: m.list.name, place: m.place, note: m.note, ticked: m.ticked });
  const listRow = (l: Awaited<ReturnType<PluckLibrary["lists"]>>[number]) => ({
    id: l.id, name: l.name, purpose: l.purpose, visibility: l.visibility, itemCount: l.itemCount, tickedCount: l.tickedCount, lastActivityAt: l.lastActivityAt,
  });

  const Limit = z.number().int().min(1).max(25);
  const Cursor = z.string().max(2000).optional().describe("From nextCursor of the previous call.");

  if (can("library:read")) {
    tool(
      "search_items",
      {
        description: "Search the person's library by words in titles, notes, tags, list names and kept page text.",
        inputSchema: z.object({
          query: z.string().min(1).max(500),
          kinds: z.array(Kind).optional(),
          tagIds: z.array(ObjectIdString).max(10).optional(),
          listId: ObjectIdString.optional(),
          status: Status.optional().describe("Leave out to search everything except the bin."),
          since: DueAt.optional().describe("Only items saved after this time (ISO 8601)."),
          limit: Limit.default(10),
          cursor: Cursor,
        }),
        annotations: READ,
      },
      async ({ query, ...q }) => {
        const res = await lib.search({ q: query, ...q });
        return { total: res.total, items: await cards(res.results.map((r) => r.item)), nextCursor: res.nextCursor };
      },
    );

    tool(
      "list_items",
      {
        description: "Browse the person's items by status, newest first or least recently touched first.",
        inputSchema: z.object({
          status: Status.default("inbox"),
          kinds: z.array(Kind).optional(),
          sort: z.enum(["newest", "untouched"]).default("newest"),
          limit: Limit.default(25),
          cursor: Cursor,
        }),
        annotations: READ,
      },
      async (q) => {
        const page = await lib.browse(q);
        return { items: await cards(page.items), nextCursor: page.nextCursor };
      },
    );

    tool(
      "get_item",
      {
        description: "Read one item in full: its kept text (paged), note, highlights and the lists it is in.",
        inputSchema: z.object({
          id: ObjectIdString,
          include: z.array(z.enum(["text", "highlights", "lists"])).default(["text", "highlights", "lists"]),
          cursor: Cursor.describe("textCursor from the previous call, to read the next page of text."),
        }),
        annotations: READ,
      },
      async ({ id, include, cursor }) => {
        const item = await lib.item(id);
        if (cursor) return { id, ...textPage(await lib.text(id), readOffset(cursor)) };
        const out: Record<string, unknown> = {
          item: { ...card(item, await names()), status: item.status, note: item.note, dueAt: item.dueAt, author: item.author, wordCount: item.wordCount, extraction: item.extraction.state, facts: item.facts },
        };
        if (include.includes("text")) {
          const page = textPage(await lib.text(id), 0);
          out.text = page.text;
          out.textCursor = page.nextCursor;
        }
        if (include.includes("highlights")) out.highlights = (await lib.highlights(id)).map((h) => ({ quote: h.quote, note: h.note }));
        if (include.includes("lists")) out.lists = (await lib.memberships(id)).map(membershipRow);
        return out;
      },
    );

    tool("list_tags", { description: "The person's tags with how many items carry each.", inputSchema: z.object({ cursor: Cursor }), annotations: READ }, async ({ cursor }) => {
      const tags = (await lib.tags()).map((t) => ({ id: t.id, name: t.name, count: t.count, madeByAi: t.createdBy === "mcp" }));
      const { rows, nextCursor } = fit(tags, readOffset(cursor));
      return { tags: rows, nextCursor };
    });

    tool("list_lists", { description: "The person's lists with purpose, counts and visibility.", inputSchema: z.object({ cursor: Cursor }), annotations: READ }, async ({ cursor }) => {
      const { rows, nextCursor } = fit((await lib.lists()).map(listRow), readOffset(cursor));
      return { lists: rows, nextCursor };
    });

    tool(
      "get_list",
      { description: "One list in order, with each item's note and tick for that list.", inputSchema: z.object({ id: ObjectIdString, cursor: Cursor }), annotations: READ },
      async ({ id, cursor }) => {
        const { list, entries } = await lib.list(id);
        const n = await names();
        const { rows, nextCursor } = fit(entries.map((e) => entryRow(e, n)), readOffset(cursor));
        return { list: listRow(list), entries: rows, nextCursor };
      },
    );

    tool(
      "get_digest",
      {
        description: "What needs a decision: items about to expire, todos due, the oldest inbox items and quiet lists.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(25).default(5) }),
        annotations: READ,
      },
      async ({ limit }) => lib.digest(limit),
    );
  }

  if (can("library:write")) {
    tool(
      "save_item",
      {
        description: "Pluck a link, every link in a block of text, or a note, todo or thing; saving a link twice brings it back to the inbox.",
        inputSchema: z
          .object({
            url: z.string().min(1).max(4096).optional(),
            text: z.string().min(1).max(100_000).optional().describe("Links in it are plucked one by one; with no links, or with kind note, todo or thing, it is saved as that text."),
            kind: Kind.optional(),
            title: z.string().max(500).optional(),
            note: z.string().max(10_000).optional(),
            tagIds: z.array(z.string().min(1).max(64)).max(20).optional().describe("Existing tag ids or names; unknown ones are refused with the nearest matches."),
            listId: ObjectIdString.optional(),
            dueAt: DueAt.optional(),
          })
          .refine((b) => (b.url === undefined) !== (b.text === undefined), { message: "Send url or text." }),
        annotations: WRITE, // a link twice is one item, but a note twice is two
      },
      async ({ tagIds: tagRefs, listId, ...body }) => {
        // Check the tags and the list before anything is saved: an error after the pluck would leave the item made,
        // and an AI tool that retries would make it again.
        if (listId) await lib.list(listId);
        const tagIds = tagRefs?.length ? await lib.tagIdsFor(tagRefs) : [];
        const res = await lib.pluck({ ...body, source: "mcp" });
        const ids = res.results.map((r) => r.item.id);
        if (ids.length && tagIds.length) await lib.batch({ itemIds: ids, patch: { addTagIds: tagIds } });
        if (ids.length && listId) await lib.addToList(listId, ids);
        const items = tagIds.length ? await Promise.all(ids.map((id) => lib.item(id))) : res.results.map((r) => r.item);
        const n = await names();
        return { saved: items.map((item, i) => ({ ...card(item, n), created: res.results[i]!.created })), rejected: res.rejected };
      },
    );

    tool(
      "batch_update",
      {
        description: "Apply one change to up to 100 items: status, kind, due date, note, or adding and removing existing tags.",
        inputSchema: z.object({
          itemIds: z.array(ObjectIdString).min(1).max(100),
          patch: z
            .object({
              status: Status.optional(),
              kind: Kind.optional(),
              dueAt: DueAt.nullable().optional(),
              note: z.string().max(10_000).nullable().optional(),
              addTagIds: z.array(z.string().min(1).max(64)).max(50).optional().describe("Existing tag ids or names; unknown ones are refused with the nearest matches."),
              removeTagIds: z.array(z.string().min(1).max(64)).max(50).optional(),
            })
            .strict()
            .refine((p) => Object.keys(p).length > 0, { message: "Send at least one change." }),
        }),
        annotations: { ...WRITE, idempotentHint: true },
      },
      (body) => lib.batch(body),
    );

    tool(
      "create_tag",
      { description: "Make a new tag, only after the person has agreed to its name.", inputSchema: z.object({ name: z.string().trim().min(1).max(40) }), annotations: WRITE },
      async ({ name }) => {
        const { tag, created } = await lib.createTag(name);
        return { tag: { id: tag.id, name: tag.name }, created };
      },
    );

    tool(
      "create_list",
      {
        description: "Make a private list with a purpose line and items in order, each with an optional note.",
        inputSchema: z.object({
          name: z.string().trim().min(1).max(120),
          purpose: z.string().max(500).optional(),
          items: z.array(z.object({ itemId: ObjectIdString, note: z.string().max(2000).optional() })).max(200).optional(),
        }),
        annotations: WRITE,
      },
      async (body) => ({ list: listRow(await lib.createList(body)) }),
    );

    tool(
      "update_list",
      {
        description: "Rename a list, add, remove or reorder its items, set an item's note or tick (ticking a todo or thing also sets it done), or make it private; only the person can make a list public, from the list in Pluck.",
        inputSchema: z
          .object({
            id: ObjectIdString,
            name: z.string().trim().min(1).max(120).optional(),
            add: z.array(z.object({ itemId: ObjectIdString, note: z.string().max(2000).optional() })).max(100).optional(),
            remove: z.array(ObjectIdString).max(100).optional(),
            entries: z.array(z.object({ itemId: ObjectIdString, note: z.string().max(2000).nullable().optional(), ticked: z.boolean().optional() })).max(100).optional(),
            order: z.array(ObjectIdString).max(1000).optional().describe("Every item in the list, in the new order."),
            visibility: z.enum(["private", "public"]).optional(),
          })
          .strict()
          .describe("The purpose line belongs to the person and cannot be changed here."),
        annotations: WRITE,
      },
      async ({ id, name, add, remove, entries, order, visibility }) => {
        // Text in a plucked page can steer the AI, so publishing never happens on the AI's word alone.
        if (visibility === "public")
          throw Object.assign(new Error("Only the person can make a list public. Ask them to open the list in Pluck and set it to Public there."), { code: "forbidden" });
        await lib.list(id); // missing list: not_found before anything changes
        if (name) await lib.renameList(id, name);
        for (const itemId of remove ?? []) await lib.removeFromList(id, itemId);
        for (const a of add ?? []) await lib.addToList(id, [a.itemId], a.note);
        for (const e of entries ?? []) await lib.editEntry(id, e.itemId, { note: e.note, ticked: e.ticked });
        if (order) await lib.reorder(id, order);
        if (visibility) await lib.makePrivate(id);
        const { list } = await lib.list(id);
        return { list: listRow(list) };
      },
    );
  }

  if (can("library:delete")) {
    tool(
      "delete_item",
      { description: "Move an item to the bin, where the person can restore it for 30 days.", inputSchema: z.object({ id: ObjectIdString }), annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
      async ({ id }) => {
        await lib.deleteItem(id);
        return { binned: id };
      },
    );
  }

  if (can("library:read")) {
    server.registerResource(
      "item",
      new ResourceTemplate("item://{id}", { list: undefined }),
      { description: "One item as Markdown: title, link, note and kept text.", mimeType: "text/markdown" },
      async (uri, { id }) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await itemMarkdown(lib, String(id)) }] }),
    );
    server.registerResource(
      "list",
      new ResourceTemplate("list://{id}", {
        list: async () => ({ resources: (await lib.lists()).map((l) => ({ uri: `list://${l.id}`, name: l.name, description: l.purpose || undefined, mimeType: "text/markdown" })) }),
      }),
      { description: "One list as Markdown, in order, with each item's note.", mimeType: "text/markdown" },
      async (uri, { id }) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await listMarkdown(lib, String(id)) }] }),
    );
    registerPrompts(server, { canWrite: can("library:write") });
  }

  return server;
}

async function itemMarkdown(lib: PluckLibrary, id: string): Promise<string> {
  const [item, text] = await Promise.all([lib.item(id), lib.text(id)]);
  const lines = [`# ${item.title}`, ""];
  if (item.url) lines.push(item.url);
  lines.push([item.siteName, item.kind, `saved ${item.createdAt.slice(0, 10)}`].filter(Boolean).join(" · "), "");
  if (item.note) lines.push(`Note: ${item.note}`, "");
  if (text) {
    const page = textPage(text, 0, TEXT_PAGE_CHARS);
    lines.push("---", "", page.text);
    if (page.nextCursor) lines.push("", `(The text goes on. Read the rest with get_item, cursor ${page.nextCursor}.)`);
  }
  return lines.join("\n");
}

async function listMarkdown(lib: PluckLibrary, id: string): Promise<string> {
  const { list, entries } = await lib.list(id);
  const lines = [`# ${list.name}`, ...(list.purpose ? ["", list.purpose] : []), ""];
  entries.forEach((e, i) => {
    const title = e.item.url ? `[${e.item.title}](${e.item.url})` : e.item.title;
    lines.push(`${i + 1}. ${e.ticked ? "[x] " : ""}${title} (item://${e.item.id})`);
    if (e.note) lines.push(`   ${e.note}`);
  });
  return lines.join("\n");
}
