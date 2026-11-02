import { expect, test } from "vitest";
import { isRenameable, showsFile } from "./preview.ts";

const link = { kind: "link" as const, preview: "reader" as const, title: "How MCP auth works", url: "https://example.com/mcp", titleIsDerived: true };

test("players, posts and pictures can be named; an article keeps its page's title", () => {
  expect(isRenameable({ ...link, kind: "video", preview: "player" })).toBe(true);
  expect(isRenameable({ ...link, preview: "post" })).toBe(true);
  expect(isRenameable({ ...link, kind: "image", preview: null })).toBe(true);
  expect(isRenameable(link)).toBe(false);
  expect(isRenameable({ ...link, preview: "code" })).toBe(false);
});

test("a link whose title is still its address can be named, until someone does", () => {
  expect(isRenameable({ ...link, title: link.url })).toBe(true);
  expect(isRenameable({ ...link, title: link.url, titleIsDerived: false })).toBe(false);
});

test("a read PDF opens on its file until it is shown as an article; a paper's landing page reads as one", () => {
  const done = { state: "done" as const, attempts: 1, lastError: null };
  expect(showsFile({ kind: "pdf", preview: "document", extraction: done })).toBe(true);
  expect(showsFile({ kind: "pdf", preview: "reader", extraction: done })).toBe(false);
  expect(showsFile({ kind: "pdf", preview: "document", extraction: { ...done, state: "pending" } })).toBe(false);
  expect(showsFile({ kind: "link", preview: "document", extraction: done })).toBe(false);
});
