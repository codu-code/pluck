import { Digest, HighlightInItem, Item, List, ObjectIdString, PluckResponse, Tag } from "@pluck/shared-schemas";
import { z } from "zod";

// What an AI tool sees of an item in any list of results, and nothing else.
// `preview` says what a link is (reader: an article; post, code, product, site, document, app, player), beyond its Kind.
export const Card = Item.pick({ id: true, title: true, kind: true, preview: true, siteName: true, excerpt: true, url: true }).extend({
  tags: z.array(z.string()), // names, not ids
  savedAt: z.string(),
});
export type Card = z.infer<typeof Card>;

const ListRow = List.pick({ id: true, name: true, purpose: true, visibility: true, itemCount: true, tickedCount: true, lastActivityAt: true });
const MembershipRow = z.object({ listId: ObjectIdString, name: z.string(), place: z.number().int(), note: z.string().nullable(), ticked: z.boolean() });
const NextCursor = z.string().nullable();

// What each tool answers with: its outputSchema, and the structuredContent sent beside the same JSON as text.
// The handlers in server.ts are typed from these, so a tool cannot answer with another shape.
export const Results = {
  search_items: z.object({ total: z.number().int(), items: z.array(Card), nextCursor: NextCursor }),
  list_items: z.object({ items: z.array(Card), nextCursor: NextCursor }),
  // The first call answers with `item` and whatever `include` asked for; a later page of text with `id`, `text` and `textCursor`.
  get_item: z.object({
    item: Card.extend(Item.pick({ status: true, note: true, dueAt: true, author: true, wordCount: true }).shape)
      // facts is an open object here: Facts is checked by types where pages are read, not on write, and a stored fact
      // past one of its limits must not make the whole Item unreadable.
      .extend({ extraction: Item.shape.extraction.shape.state, facts: z.record(z.string(), z.unknown()) })
      .optional(),
    id: ObjectIdString.optional(),
    text: z.string().optional(),
    textCursor: NextCursor.optional(),
    highlights: z.array(HighlightInItem.pick({ quote: true, note: true })).optional(),
    lists: z.array(MembershipRow).optional(),
  }),
  list_highlights: z.object({
    highlights: z.array(HighlightInItem.pick({ quote: true, note: true, item: true }).extend({ highlightedAt: z.string() })),
    nextCursor: NextCursor,
  }),
  list_tags: z.object({ tags: z.array(Tag.pick({ id: true, name: true, count: true }).extend({ madeByAi: z.boolean() })), nextCursor: NextCursor }),
  list_lists: z.object({ lists: z.array(ListRow), nextCursor: NextCursor }),
  get_list: z.object({
    list: ListRow,
    entries: z.array(Card.extend({ note: z.string().nullable(), noteBy: z.enum(["user", "ai"]).nullable(), ticked: z.boolean() })),
    nextCursor: NextCursor,
  }),
  get_digest: Digest,
  save_item: z.object({ saved: z.array(Card.extend({ created: z.boolean() })), rejected: PluckResponse.shape.rejected }),
  batch_update: z.object({ matched: z.number().int(), updated: z.number().int() }),
  create_tag: z.object({ tag: Tag.pick({ id: true, name: true }), created: z.boolean() }),
  create_list: z.object({ list: ListRow }),
  update_list: z.object({ list: ListRow }),
  delete_item: z.object({ binned: ObjectIdString }),
};
export type Results = { [K in keyof typeof Results]: z.infer<(typeof Results)[K]> };

const EXCERPT_CHARS = 280;
export const TEXT_PAGE_CHARS = 80_000; // about 20k tokens of kept text per get_item call
export const RESPONSE_CHARS = 32_000; // about 8k tokens for everything else

export function card(item: Item, tagNames: Map<string, string>): Card {
  const excerpt = item.excerpt && item.excerpt.length > EXCERPT_CHARS ? `${item.excerpt.slice(0, EXCERPT_CHARS - 1)}…` : item.excerpt;
  return {
    id: item.id, title: item.title, kind: item.kind, preview: item.preview, siteName: item.siteName, excerpt,
    tags: item.tagIds.map((id) => tagNames.get(id)).filter((n): n is string => Boolean(n)),
    savedAt: item.createdAt, url: item.url,
  };
}

export const tagNameMap = (tags: Tag[]) => new Map(tags.map((t) => [t.id, t.name]));

// Opaque cursors: an offset for paging we do here, or the library's own cursor passed through.
export const offsetCursor = (n: number) => Buffer.from(`o:${n}`).toString("base64url");
export function readOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  const m = /^o:(\d+)$/.exec(Buffer.from(cursor, "base64url").toString());
  if (!m) throw Object.assign(new Error("That cursor is not from this tool."), { code: "bad_request" });
  return Number(m[1]);
}

// One page of a long text, cut at a paragraph or line break near the limit so a sentence is not split.
export function textPage(text: string, offset: number, size = TEXT_PAGE_CHARS): { text: string; nextCursor: string | null } {
  if (offset + size >= text.length) return { text: text.slice(offset), nextCursor: null };
  const window = text.slice(offset, offset + size);
  const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"));
  const end = cut > size * 0.5 ? cut + 1 : size;
  return { text: window.slice(0, end), nextCursor: offsetCursor(offset + end) };
}

// Takes rows from the start until the JSON would pass the response cap; the rest is the next page.
export function fit<T>(rows: T[], offset: number, max = RESPONSE_CHARS): { rows: T[]; nextCursor: string | null } {
  const out: T[] = [];
  let size = 0;
  for (let i = offset; i < rows.length; i++) {
    const n = JSON.stringify(rows[i]).length + 1;
    if (out.length && size + n > max) return { rows: out, nextCursor: offsetCursor(i) };
    out.push(rows[i]!);
    size += n;
  }
  return { rows: out, nextCursor: null };
}
