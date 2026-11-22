import { expect, test } from "vitest";
import { deriveExcerpt, deriveTitle, plainLine, sameNote } from "./notes.ts";

test("title is the first non-empty line, trimmed and capped", () => {
  expect(deriveTitle("\n\n  An MCP server  \nbody")).toBe("An MCP server");
  expect(deriveTitle("   ")).toBe("Untitled note");
  expect(deriveTitle("x".repeat(300))).toHaveLength(200);
});

test("excerpt skips the title line only when the title is derived", () => {
  const text = "Title line\nFirst body line.\n\n- a\n- b";
  expect(deriveExcerpt(text, true)).toBe("First body line. a b"); // list markers are marks, not words
  expect(deriveExcerpt(text, false)).toBe("Title line First body line. a b");
  expect(deriveExcerpt("Only a title", true)).toBeNull();
});

test("a formatted Note's title and row are plain words: the marks are dropped, what was typed is kept", () => {
  const text = "# A **blog** idea\n\n- first *point*\n1. [a link](https://example.test/a) to read\n\nsnake\\_case and 5 \\* 2";
  expect(deriveTitle(text)).toBe("A blog idea");
  expect(deriveExcerpt(text, true)).toBe("first point a link to read snake_case and 5 * 2");
  expect(deriveTitle("## \n**Bold first line**")).toBe("Bold first line"); // an empty heading is no title
  // Words that only look like marks stay as they were typed.
  expect(plainLine("snake_case_name and 2 * 3 * 4")).toBe("snake_case_name and 2 * 3 * 4");
  expect(plainLine("_whole line_")).toBe("whole line");
  expect(plainLine("10. tenth")).toBe("tenth");
  expect(plainLine("C# is a language")).toBe("C# is a language");
});

test("the two editors' spellings of one Note are the same Note; anything an editor dropped is not", () => {
  // As the iPhone writes it, and as the web does: escapes, list nesting by three spaces or two, spaces at a line's end.
  expect(sameNote("5 * 2 and snake_case\n- one\n   - nested\n      - deeper\nend  ", "5 \\* 2 and snake\\_case\n- one\n  - nested\n    - deeper\nend\n")).toBe(true);
  expect(sameNote("line one\nline two\n\npara", "line one\nline two\n\npara")).toBe(true);
  // What the web editor makes of a quote, a table, code and a task: words lost, so not the same.
  expect(sameNote("> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [ ] task", "quote\n\nab12\n\n- task")).toBe(false);
  expect(sameNote("`code` and __under__", "code and _under_")).toBe(false);
  expect(sameNote("two\n\nparas", "two\nparas")).toBe(false); // a blank line is a line
});
