import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { extractUrls } from "./urls.ts";

type Fixture = { name: string; text?: string; urls?: string[]; generate?: number; expectCount?: number };
const fixtures: Fixture[] = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/paste.json"), "utf8"));

test.each(fixtures)("$name", (f) => {
  if (f.generate) {
    const text = Array.from({ length: f.generate }, (_, i) => `https://example.com/item/${i}`).join("\n");
    expect(extractUrls(text)).toHaveLength(f.expectCount!);
    return;
  }
  expect(extractUrls(f.text!)).toEqual(f.urls);
});
