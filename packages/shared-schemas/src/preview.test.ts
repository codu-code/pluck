import { expect, test } from "vitest";
import { isRenameable } from "./preview.ts";

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
