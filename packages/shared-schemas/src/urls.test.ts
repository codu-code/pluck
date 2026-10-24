import { expect, test } from "vitest";
import { normalizeUrl } from "./urls.ts";

test.each([
  ["https://Example.com/a?utm_source=x&b=2&a=1#top", "https://example.com/a?a=1&b=2"],
  ["http://example.com:80/", "http://example.com/"],
  ["https://x.com/niall/status/1?s=20&t=abc", "https://x.com/niall/status/1"],
  ["https://www.youtube.com/watch?v=abc&si=xyz&feature=share", "https://www.youtube.com/watch?v=abc"],
  ["https://example.com/p?fbclid=1&gclid=2&id=7", "https://example.com/p?id=7"],
  ["  https://example.com/x  ", "https://example.com/x"],
])("%s → %s", (input, expected) => {
  expect(normalizeUrl(input)).toBe(expected);
});

test.each(["ftp://example.com", "javascript:alert(1)", "not a url", "https://nodot/"])("%s is rejected", (input) => {
  expect(normalizeUrl(input)).toBeNull();
});
