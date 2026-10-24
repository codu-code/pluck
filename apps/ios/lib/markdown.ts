// The kept page text, as blocks the reader draws natively. Only what extraction produces: headings, paragraphs,
// lists, quotes and code. Inline marks are dropped to plain text.
export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "item"; text: string; ordered: boolean }
  | { type: "quote"; text: string }
  | { type: "code"; text: string };

const inline = (s: string) =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .trim();

export function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: "paragraph", text: inline(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i]!);
      out.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    const q = /^>\s?(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (h) { flush(); out.push({ type: "heading", level: h[1]!.length, text: inline(h[2]!) }); }
    else if (li) { flush(); out.push({ type: "item", text: inline(li[2]!), ordered: /\d/.test(li[1]!) }); }
    else if (q) { flush(); out.push({ type: "quote", text: inline(q[1]!) }); }
    else para.push(line.trim());
  }
  flush();
  return out.filter((b) => b.text.length > 0);
}

// Splits text around highlighted quotes, so the reader can mark them.
export function marks(text: string, quotes: string[]): { text: string; mark: boolean }[] {
  const hits = quotes.map((q) => q.trim()).filter((q) => q && text.includes(q));
  if (!hits.length) return [{ text, mark: false }];
  const re = new RegExp(`(${hits.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return text.split(re).filter(Boolean).map((t) => ({ text: t, mark: hits.includes(t) }));
}
