import { expect, test } from "vitest";
import { magicLinkEmail } from "./emails";
import { linkPageUrl, linkParams, verifyUrl } from "./signin-link";

const verify = "https://getpluck.io/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fapi%2Fauth%2Foauth2%2Fauthorize%3Fclient_id%3Dx&evil=1";

test("the email points at our own page, which only a tap turns back into verify", () => {
  const page = linkPageUrl(verify);
  expect(page).toBe("https://getpluck.io/signin/link?token=abc123&callbackURL=%2Fapi%2Fauth%2Foauth2%2Fauthorize%3Fclient_id%3Dx");
  const q = linkParams(Object.fromEntries(new URL(page).searchParams));
  const form = new FormData();
  for (const [k, v] of Object.entries(q)) form.set(k, v!);
  form.set("evil", "1"); // anything else on the form is dropped
  expect(verifyUrl("https://getpluck.io", form)).toBe("https://getpluck.io/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fapi%2Fauth%2Foauth2%2Fauthorize%3Fclient_id%3Dx");
  expect(verifyUrl("https://getpluck.io", new FormData())).toBeNull();
});

test("the sign-in email shows the link to copy and the code, and invites no reply", () => {
  const e = magicLinkEmail("a@example.test", "https://getpluck.io/signin/link?token=abc", "482913");
  expect(e.replyTo).toBeNull();
  expect(e.subject).toContain("482913");
  expect(e.text).toContain("482913");
  expect(e.html).toContain(">482913</p>");
  expect(e.text).toContain("https://getpluck.io/signin/link?token=abc");
  expect(e.html).toContain("Copy this link into your browser:<br><a href=\"https://getpluck.io/signin/link?token=abc\"");
});
