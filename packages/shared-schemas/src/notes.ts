// Notes, todos and things: the title is the first non-empty line unless the person typed one.

export const TEXT_KINDS = ["note", "todo", "thing"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];
export const isTextKind = (k: string | undefined): k is TextKind => (TEXT_KINDS as readonly string[]).includes(k ?? "");

export function deriveTitle(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean);
  if (!line) return "Untitled note";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

// The row's second line: the body after the title line when the title is derived, the body otherwise.
export function deriveExcerpt(text: string, titleIsDerived: boolean): string | null {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.trim());
  const body = (titleIsDerived && first >= 0 ? lines.slice(first + 1) : lines).join(" ").replace(/\s+/g, " ").trim();
  return body ? body.slice(0, 200) : null;
}
