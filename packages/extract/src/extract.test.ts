import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { extract, extractFromHtml } from "./extract.ts";

const FIX = "http://127.0.0.1:4180";

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

test("pages in windows-1252 read right, whether the header or only a <meta> says so", async () => {
  expect((await extract({ url: `${FIX}/latin1` })).title).toBe("Café crème");
  const meta = await extract({ url: `${FIX}/latin1-meta` });
  expect(meta.title).toBe("Déjà vu");
  expect(meta.markdown).toContain("Un café crème à la terrasse");
});

test("a PDF whose name has a stray % is kept, named as served", async () => {
  const x = await extract({ url: `${FIX}/odd/50%off.pdf` });
  expect(x.kind).toBe("pdf");
  expect(x.wordCount).toBeGreaterThan(0);
});
