// Notes, todos and things: the title is the first non-empty line unless the person typed one.

export const TEXT_KINDS = ["note", "todo", "thing"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];
export const isTextKind = (k: string | undefined): k is TextKind => (TEXT_KINDS as readonly string[]).includes(k ?? "");
// The Kinds that can be Done: a Todo or Thing gets finished, a Note does not.
export const TASK_KINDS = ["todo", "thing"] as const;
export const isTask = (k: string): boolean => (TASK_KINDS as readonly string[]).includes(k);

// A line of a Note's text with its Markdown marks taken off: the heading or list marker it starts with, bold and
// italic, a link down to its words, and the backslash before an escaped character. A Note's text is Markdown
// (docs/adr/0002); its title, its row and what search shows of it are plain words.
export function plainLine(line: string): string {
  return line
    .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*\\])[*_]([^*_\s](?:[^*_]*[^*_\s])?)[*_](?![\w*])/g, "$1$2")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
    .trim();
}

export function deriveTitle(text: string): string {
  const line = text.split("\n").map(plainLine).find(Boolean);
  if (!line) return "Untitled note";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

// The row's second line: the body after the title line when the title is derived, the body otherwise.
export function deriveExcerpt(text: string, titleIsDerived: boolean): string | null {
  const lines = text.split("\n").map(plainLine);
  const first = lines.findIndex(Boolean);
  const body = (titleIsDerived && first >= 0 ? lines.slice(first + 1) : lines).join(" ").replace(/\s+/g, " ").trim();
  return body ? body.slice(0, 200) : null;
}
