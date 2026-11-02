import { expect, test } from "vitest";
import { APP_GRANT, FIRST_PARTY_REDIRECTS, TRY_COOKIE, viaOf } from "./auth";
import { ORIGIN } from "./origin";

const at = (query: Record<string, string>, headers: Record<string, string> = {}) => viaOf({ query, headers: new Headers(headers) });
const authorize = (redirect: string) => `/api/auth/oauth2/authorize?${new URLSearchParams({ client_id: "c", redirect_uri: redirect })}`;

test("a new account's via comes from the sign-in request that made it", () => {
  expect(at({}, { [APP_GRANT.header]: APP_GRANT.value })).toBe("ios");
  expect(at({ callbackURL: "/inbox" }, { cookie: `a=1; ${TRY_COOKIE}=abc` })).toBe("try");
  expect(at({ callbackURL: "/try/claim" })).toBe("try");
  expect(at({ callbackURL: authorize("https://claude.ai/api/mcp/auth_callback") })).toBe("mcp");
  expect(at({ callbackURL: authorize(FIRST_PARTY_REDIRECTS[0]!) })).toBe("extension");
  expect(at({ callbackURL: "/copy/abc" })).toBe("public-page");
  expect(at({ callbackURL: "/shared/abc" })).toBe("shared-list");
  expect(at({ callbackURL: "/inbox" })).toBe("direct");
  // A code typed on the web: the sign-in page it was typed on says where it was going.
  expect(at({}, { referer: `${ORIGIN}/signin?sig=x&client_id=c&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcb` })).toBe("mcp");
  expect(at({}, { referer: `${ORIGIN}/signin?next=%2Fshared%2Fabc` })).toBe("shared-list");
  expect(viaOf(null)).toBe("direct");
});
