import { describe, expect, test } from "vitest";
import { normalizeUrl, withReferral } from "./urls.ts";

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

describe("withReferral", () => {
  test("tags a link as it opens", () => {
    expect(withReferral("https://example.com/post")).toBe("https://example.com/post?utm_source=getpluck.io");
    expect(withReferral("https://example.com/p?id=3#part-2")).toBe("https://example.com/p?id=3&utm_source=getpluck.io#part-2");
  });
  test("leaves alone what one more parameter would break, what is ours and what already says its source", () => {
    for (const url of [
      "https://bucket.s3.amazonaws.com/a.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc",
      "https://d111.cloudfront.net/a.pdf?Expires=1&Signature=abc&Key-Pair-Id=K",
      "https://example.com/?utm_source=newsletter",
      "https://getpluck.io/@niall/reading",
      "mailto:someone@example.com",
      "not a url",
    ]) expect(withReferral(url)).toBe(url);
  });
});
