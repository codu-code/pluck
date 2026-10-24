import { expect, test } from "vitest";
import { renderReader } from "./markdown";

test("raw HTML from a kept page is escaped, never rendered", () => {
  const html = renderReader('Hello <script>alert(1)</script> <img src=x onerror="alert(2)">');
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("&lt;script&gt;");
});

test("script links are dropped, real links open outside without a referrer", () => {
  const html = renderReader("[bad](javascript:alert(1)) [ok](https://example.com) ![pic](https://example.com/a.png)");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">ok</a>');
  expect(html).toContain('loading="lazy" referrerpolicy="no-referrer"');
});
