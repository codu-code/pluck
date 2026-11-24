// The #tags in what someone wrote: "#recipes" at the start of a word, as it is typed. What they do to the Item's tags
// is packages/db's tagByWords.
//
// Not a tag: a heading ("# Title" has a space), a link's fragment or anchor, a number ("#1"), a colour ("#c0ffee"),
// or anything inside code (a fence still open counts as code to the end). The rich editor keeps some characters with
// a backslash before them ("\#", "\_"): the same words.
// shortcut: a tag ends at the first character that is not a letter, a number, "_" or "-", so in writing with no spaces (Chinese, Japanese) it runs on to the next punctuation mark; end it at a closing "#" too when someone asks.
export function hashTags(text: string): string[] {
  const prose = text
    .replace(/(```|~~~)[\s\S]*?(\1|$)|`[^`\n]*`/g, " ")
    .replace(/\\([#_*~-])/g, "$1");
  const seen = new Set<string>();
  return [...prose.matchAll(/(?<![^\s(]|\]\(|\]:\s)#(\p{L}[\p{L}\p{M}\p{N}_-]{0,39})/gu)]
    .map((m) => m[1]!.replace(/[-_]+$/, ""))
    .filter((name) => !(/\d/.test(name) && /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(name)))
    .filter((name) => !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()));
}
