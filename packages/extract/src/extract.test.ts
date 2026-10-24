import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { extractFromHtml } from "./extract.ts";

type Fixture = { file: string; kind: string; title: string; words: number; cover: boolean; site?: string; lang?: string; canonical?: string; author?: string; metaOnly?: boolean };
const DIR = join(import.meta.dirname, "../fixtures");
const fixtures: Fixture[] = JSON.parse(readFileSync(join(DIR, "expected.json"), "utf8"));

describe.each(fixtures)("$file", (f) => {
  test("extracts title, body, cover and metadata", async () => {
    const url = `https://example.test/${f.file}`;
    const out = await extractFromHtml(readFileSync(join(DIR, "pages", f.file), "utf8"), url);
    expect(out.title).toBe(f.title);
    if (f.metaOnly) {
      expect(out.wordCount).toBeLessThanOrEqual(30);
      expect(out.excerpt ?? out.title).toBeTruthy();
    } else {
      // Body kept, boilerplate (nav, ads, cookie banners, comments, related links) left out.
      expect(out.wordCount).toBeGreaterThanOrEqual(Math.floor(f.words * 0.9));
      expect(out.wordCount).toBeLessThanOrEqual(Math.ceil(f.words * 1.25) + 20);
    }
    expect(Boolean(out.coverUrl)).toBe(f.cover);
    if (f.cover) expect(out.coverUrl).toMatch(/^https:\/\/example\.test\/img\/cover-\d\.png$/);
    if (f.site) expect(out.siteName).toBe(f.site);
    if (f.lang) expect(out.lang).toBe(f.lang);
    if (f.canonical) expect(out.canonicalUrl).toBe(f.canonical);
    if (f.author) expect(out.author).toBe(f.author);
    if (f.kind === "video") expect(out.kind).toBe("video");
    expect(out.excerpt ?? "").not.toMatch(/\\[.\-*#]/); // no markdown escapes in the row's second line
  });
});
