import { expect, test } from "vitest";
// @ts-expect-error: a plain .mjs script, no types
import { bump, compare, newest } from "./version.mjs";

test("release numbers: patch, minor, major, and which is newest", () => {
  expect(bump("1.2.0", "patch")).toBe("1.2.1");
  expect(bump("1.2.3", "minor")).toBe("1.3.0");
  expect(bump("1.2.3", "major")).toBe("2.0.0");
  expect(compare("1.10.0", "1.9.9")).toBeGreaterThan(0); // numbers, not text
  expect(newest(["1.0.0", "1.1.0", "1.0.5"])).toBe("1.1.0");
  expect(newest([])).toBeNull();
});
