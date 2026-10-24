import { expect, test } from "vitest";
import { locate } from "./highlight-dom";

const sel = (exact: string) => ({ textQuote: { exact, prefix: "", suffix: "" }, textPosition: { start: 0, end: 0 } });

test("a highlight across paragraphs is found though the whitespace differs", () => {
  const text = "Intro.\nThe first paragraph ends here.\nThe second (with brackets) starts here.\nOutro.";
  const [a, b] = locate(text, sel("ends here.\n\nThe second (with brackets)"))!;
  expect(text.slice(a, b)).toBe("ends here.\nThe second (with brackets)");
  expect(locate(text, sel("not in the text"))).toBeNull();
});
