import { expect, test } from "vitest";
import { deriveExcerpt, deriveTitle } from "./notes.ts";

test("title is the first non-empty line, trimmed and capped", () => {
  expect(deriveTitle("\n\n  An MCP server  \nbody")).toBe("An MCP server");
  expect(deriveTitle("   ")).toBe("Untitled note");
  expect(deriveTitle("x".repeat(300))).toHaveLength(200);
});

test("excerpt skips the title line only when the title is derived", () => {
  const text = "Title line\nFirst body line.\n\n- a\n- b";
  expect(deriveExcerpt(text, true)).toBe("First body line. - a - b");
  expect(deriveExcerpt(text, false)).toBe("Title line First body line. - a - b");
  expect(deriveExcerpt("Only a title", true)).toBeNull();
});
