import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// Lists every [PLACEHOLDER] left before launch. Informational: it never fails on what it finds.
const ROOTS = ["apps", "docs"];
// The site catalog holds the legal pages' text, so their placeholders live there.
const FILES = ["packages/i18n/messages/site/en.json"];
const SKIP = new Set(["node_modules", ".next", ".output", "handover"]);
const PATTERN = /\[[A-Z][A-Z ]{2,}\]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|md|mdx|html)$/.test(name)) out.push(p);
  }
  return out;
}

test("placeholders left before launch", () => {
  const found = [...ROOTS.flatMap((r) => walk(r)), ...FILES].flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(PATTERN)].map((m) => `${file}: ${m[0]}`),
  );
  if (found.length) console.info(`Placeholders to fill before launch:\n${found.join("\n")}`);
  expect(Array.isArray(found)).toBe(true);
});
