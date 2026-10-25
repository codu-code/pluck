import { expect, test } from "@playwright/test";
import { codeFromEmail, signIn, uniqueEmail } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page).toHaveURL(/\/signin$/);
});

test("magic link signs in and lands on the empty inbox", async ({ page }) => {
  const email = uniqueEmail("signin");
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Nothing plucked yet." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toContainText(email.split("@")[0]!);
  // Signed in, /signin bounces back to the inbox.
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/inbox$/);
});

test("the code in the email signs in too, and Send again waits a minute", async ({ page }) => {
  const email = uniqueEmail("code");
  await page.goto("/signin");
  const sent = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("button", { name: /Send again in \d+s/ })).toBeDisabled();
  const code = await codeFromEmail(email, sent);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Or type the 6-digit code").fill(wrong);
  await expect(page.getByRole("alert").filter({ hasText: "That code didn't work" })).toBeVisible();
  await page.getByLabel("Or type the 6-digit code").fill(code);
  await expect(page).toHaveURL(/\/inbox$/);
});
