import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

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
