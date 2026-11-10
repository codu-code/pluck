import { describe, expect, test } from "vitest";
import { cleanUrl, extractUrls, normalizeUrl, textRuns, withReferral } from "./urls.ts";

test.each([
  ["https://Example.com/a?utm_source=x&b=2&a=1#top", "https://example.com/a?a=1&b=2"],
  ["http://example.com:80/", "http://example.com/"],
  ["https://x.com/niall/status/1?s=20&t=abc", "https://x.com/niall/status/1"],
  ["https://www.youtube.com/watch?v=abc&si=xyz&feature=share", "https://www.youtube.com/watch?v=abc"],
  ["https://example.com/p?fbclid=1&gclid=2&id=7", "https://example.com/p?id=7"],
  ["https://www.instagram.com/reel/De6Q_cyzWLC/?dlrf=MTdo&igsh=a&srtk=MTBr", "https://www.instagram.com/reel/De6Q_cyzWLC/"],
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
    expect(withReferral("https://example.com/s?q=a%20b")).toBe("https://example.com/s?q=a%20b&utm_source=getpluck.io"); // the query stays as written
    expect(withReferral("https://example.com/app#/route?x=1")).toBe("https://example.com/app?utm_source=getpluck.io#/route?x=1");
  });
  test("leaves alone what one more parameter would break, what is ours and what already says its source", () => {
    for (const url of [
      "https://bucket.s3.amazonaws.com/a.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc",
      "https://d111.cloudfront.net/a.pdf?Expires=1&Signature=abc&Key-Pair-Id=K",
      "https://storage.googleapis.com/b/a.pdf?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc",
      "https://example.com/?utm_source=newsletter",
      "https://getpluck.io/@niall/reading",
      "mailto:someone@example.com",
      "not a url",
    ]) expect(withReferral(url)).toBe(url);
  });
});

test("a post's words as text and links", () => {
  expect(textRuns("Read [getpluck.io/blog](https://getpluck.io/blog) and https://www.example.com/a/b.")).toEqual([
    { text: "Read " },
    { text: "getpluck.io/blog", href: "https://getpluck.io/blog" },
    { text: " and " },
    { text: "example.com/a/b", href: "https://www.example.com/a/b" },
    { text: "." },
  ]);
  expect(textRuns("No links here")).toEqual([{ text: "No links here" }]);
  expect(textRuns("[https://t.co/abc](https://t.co/abc)")).toEqual([{ text: "t.co/abc", href: "https://t.co/abc" }]);
});

describe("cleanUrl: the link as it is kept", () => {
  test.each([
    ["https://forum.example.com/index.php?/topic/123-title/", "https://forum.example.com/index.php?/topic/123-title/"],
    ["https://example.com/s?flag&q=a%20b&utm_source=x&a=1", "https://example.com/s?flag&q=a%20b&a=1"],
    ["https://example.com/a?b=2&a=1#section", "https://example.com/a?b=2&a=1#section"],
    ["https://app.example.com/#/doc/1", "https://app.example.com/#/doc/1"],
    ["https://Example.com/a?utm_source=x&UTM_medium=y#top", "https://example.com/a#top"],
    ["https://x.com/niall/status/1?s=20&t=abc", "https://x.com/niall/status/1"],
    ["https://example.com/p?s=20&t=abc", "https://example.com/p?s=20&t=abc"], // s and t are only X's
    ["  https://example.com/x?  ", "https://example.com/x?"],
  ])("%s → %s", (input, expected) => {
    expect(cleanUrl(input)).toBe(expected);
  });

  test.each(["ftp://example.com", "javascript:alert(1)", "not a url", "https://nodot/"])("%s is rejected", (input) => {
    expect(cleanUrl(input)).toBeNull();
  });

  test("the kept link has the key of the link given, and cleaning it again changes nothing", () => {
    for (const x of [
      "https://forum.example.com/index.php?/topic/123-title/",
      "https://example.com/s?flag&q=a%20b&utm_source=x&a=1",
      "https://example.com/a?b=2&a=1&&#section",
      "https://app.example.com/?utm_campaign=c#/doc/1",
      "https://app.example.com/#!/doc/1",
      "http://EXAMPLE.com:80/a/../b?x=%E6%9D%B1&x=1&fbclid=2",
      "https://www.youtube.com/watch?v=abc&si=xyz&feature=share#t=30",
      "https://example.com/?utm_source=x",
    ]) {
      expect(normalizeUrl(cleanUrl(x)!), x).toBe(normalizeUrl(x));
      expect(cleanUrl(cleanUrl(x)!), x).toBe(cleanUrl(x));
      expect(normalizeUrl(normalizeUrl(x)!), x).toBe(normalizeUrl(x));
    }
  });
});

test("the key keeps a fragment only when it is a route", () => {
  expect(normalizeUrl("https://app.example.com/#/doc/1")).toBe("https://app.example.com/#/doc/1");
  expect(normalizeUrl("https://app.example.com/#/doc/1")).not.toBe(normalizeUrl("https://app.example.com/#/doc/2"));
  expect(normalizeUrl("https://app.example.com/#!/doc/1")).toBe("https://app.example.com/#!/doc/1");
  expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
});

test("links in a block of text come back as they are kept, one for each key", () => {
  expect(extractUrls("https://example.com/a?b=2&a=1&utm_source=x#part https://example.com/a?a=1&b=2 https://app.example.com/#/doc/1 https://app.example.com/#/doc/2")).toEqual([
    "https://example.com/a?b=2&a=1#part",
    "https://app.example.com/#/doc/1",
    "https://app.example.com/#/doc/2",
  ]);
});
