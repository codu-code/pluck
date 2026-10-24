import { expect, test } from "vitest";
import { initials, tileIndex, when } from "./format.ts";

const now = new Date(2026, 9, 24, 15, 0); // Sat 24 Oct 2026, 15:00

test.each([
  [new Date(2026, 9, 24, 14, 59, 30), "now"],
  [new Date(2026, 9, 24, 14, 20), "40m"],
  [new Date(2026, 9, 24, 10, 0), "5h"],
  [new Date(2026, 9, 23, 22, 0), "Yesterday"],
  [new Date(2026, 9, 20, 9, 0), "Tue"],
  [new Date(2026, 9, 3, 9, 0), "3 Oct"],
  [new Date(2025, 10, 3, 9, 0), "3 Nov 2025"],
])("when(%s) is %s", (d, expected) => {
  expect(when(d.toISOString(), now)).toBe(expected);
});

test.each([
  ["YouTube", "https://www.youtube.com/watch?v=1", "YT"],
  ["X (formerly Twitter)", "https://x.com/a/status/1", "X"],
  ["The Example Times", "https://times.example.test/a", "ET"],
  [null, "https://modelcontextprotocol.io/docs", "MO"],
  ["Field Notes", "https://notes.example/a", "FN"],
])("initials(%s) is %s", (site, url, expected) => {
  expect(initials(site, url)).toBe(expected);
});

test("tile index is stable and in range", () => {
  expect(tileIndex("example.com")).toBe(tileIndex("example.com"));
  expect(tileIndex("x")).toBeGreaterThanOrEqual(0);
  expect(tileIndex("x")).toBeLessThan(6);
});
