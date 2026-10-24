import type { Item, Tag } from "@pluck/shared-schemas";

// What an AI tool sees of an item in any list of results, and nothing else.
export type Card = { id: string; title: string; kind: Item["kind"]; siteName: string | null; excerpt: string | null; tags: string[]; savedAt: string; url: string | null };

const EXCERPT_CHARS = 280;
export const TEXT_PAGE_CHARS = 80_000; // about 20k tokens of kept text per get_item call
export const RESPONSE_CHARS = 32_000; // about 8k tokens for everything else

export function card(item: Item, tagNames: Map<string, string>): Card {
  const excerpt = item.excerpt && item.excerpt.length > EXCERPT_CHARS ? `${item.excerpt.slice(0, EXCERPT_CHARS - 1)}…` : item.excerpt;
  return {
    id: item.id, title: item.title, kind: item.kind, siteName: item.siteName, excerpt,
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
