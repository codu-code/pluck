import { expect, test } from "vitest";
import { marks, parseMarkdown } from "./markdown";

test("markdown becomes blocks, and highlights split the text they appear in", () => {
  const blocks = parseMarkdown("# Title\n\nFirst **bold** line\ncontinues [link](https://x.test).\n\n- one\n2. two\n\n> quoted\n\n```\ncode\n```");
  expect(blocks).toEqual([
    { type: "heading", level: 1, text: "Title" },
    { type: "paragraph", text: "First bold line continues link." },
    { type: "item", text: "one", ordered: false },
    { type: "item", text: "two", ordered: true },
    { type: "quote", text: "quoted" },
    { type: "code", text: "code" },
  ]);
  expect(marks("The scope is the contract. Refresh is next.", ["scope is the contract"])).toEqual([
    { text: "The ", mark: false }, { text: "scope is the contract", mark: true }, { text: ". Refresh is next.", mark: false },
  ]);
});
