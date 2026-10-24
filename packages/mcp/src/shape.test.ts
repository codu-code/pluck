import { expect, test } from "vitest";
import { fit, offsetCursor, readOffset, textPage } from "./shape";

test("long text pages at a line break and the cursor walks the whole text", () => {
  const text = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} ${"word ".repeat(60)}`).join("\n\n");
  let offset = 0;
  let joined = "";
  for (let guard = 0; guard < 50; guard++) {
    const page = textPage(text, offset, 10_000);
    expect(page.text.length).toBeLessThanOrEqual(10_000);
    joined += page.text;
    if (!page.nextCursor) break;
    expect(page.text.endsWith("\n")).toBe(true);
    offset = readOffset(page.nextCursor);
  }
  expect(joined).toBe(text);
});

test("rows stop at the cap and pick up where they left off", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({ i, pad: "x".repeat(1000) }));
  const first = fit(rows, 0, 10_000);
  expect(first.rows.length).toBeLessThan(50);
  const second = fit(rows, readOffset(first.nextCursor!), 10_000);
  expect(second.rows[0]).toEqual(rows[first.rows.length]);
});

test("a cursor from somewhere else is refused", () => {
  expect(() => readOffset("bm9wZQ")).toThrow("not from this tool");
  expect(readOffset(offsetCursor(7))).toBe(7);
});
