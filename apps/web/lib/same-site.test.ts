import { expect, test } from "vitest";
import { samePath } from "./same-site";

test("a path on this site goes through; anything a browser reads as another site does not", () => {
  for (const ok of ["/inbox", "/items/abc?x=1#top", "/lists/a/b", "/try/claim"]) expect(samePath(ok, "/inbox")).toBe(ok);
  for (const bad of [undefined, "", "inbox", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\\/evil.com", "https://evil.com", "/a\u0000b", "/a\nb", "\\\\evil.com"])
    expect(samePath(bad, "/inbox")).toBe("/inbox");
});
