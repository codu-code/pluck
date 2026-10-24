import type { Highlight } from "@pluck/shared-schemas";

// Highlights are anchored by character offsets into the article's text, with the quote and its
// neighbours as a fallback when the text has shifted.

export function offsetsOf(root: HTMLElement, range: Range): { start: number; end: number } {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

export function selectorFor(root: HTMLElement, range: Range): Highlight["selector"] {
  const { start, end } = offsetsOf(root, range);
  const text = root.textContent ?? "";
  return {
    textQuote: { exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) },
    textPosition: { start, end },
  };
}

export function locate(text: string, s: Highlight["selector"]): [number, number] | null {
  const { start, end } = s.textPosition;
  const { exact, prefix, suffix } = s.textQuote;
  if (text.slice(start, end) === exact) return [start, end];
  const withContext = text.indexOf(prefix + exact + suffix);
  if (withContext >= 0) return [withContext + prefix.length, withContext + prefix.length + exact.length];
  const bare = text.indexOf(exact);
  if (bare >= 0) return [bare, bare + exact.length];
  // A selection made in the browser across paragraphs reads "a\n\nb" where the reader's text has "a\nb":
  // match any run of whitespace for any other.
  const loose = new RegExp(exact.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  const m = exact.trim() ? loose.exec(text) : null;
  return m ? [m.index, m.index + m[0].length] : null;
}

// Wraps [start, end) in <mark> elements, one per text node it crosses.
function wrap(root: HTMLElement, start: number, end: number, id: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: [Text, number, number][] = [];
  let pos = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const len = node.data.length;
    const a = Math.max(start, pos);
    const b = Math.min(end, pos + len);
    if (a < b) hits.push([node, a - pos, b - pos]);
    pos += len;
    if (pos >= end) break;
  }
  for (const [node, a, b] of hits) {
    const middle = node.splitText(a);
    middle.splitText(b - a);
    const mark = document.createElement("mark");
    mark.dataset.highlight = id;
    middle.replaceWith(mark);
    mark.append(middle);
  }
}

export function paint(root: HTMLElement, html: string, highlights: Highlight[]) {
  root.innerHTML = html;
  const text = root.textContent ?? "";
  for (const h of highlights) {
    const at = locate(text, h.selector);
    if (at) wrap(root, at[0], at[1], h.id);
  }
}
