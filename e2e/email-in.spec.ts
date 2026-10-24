import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { putObject } from "./db";
import { signIn } from "./helpers";

test("forward a newsletter to your address and it lands as a Read item you can open", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  const address = (await page.locator("#email code").textContent())!;
  expect(address).toMatch(/^pluck\+[a-f0-9]{12}@in\.getpluck\.io$/);
  const token = address.match(/pluck\+(\w+)@/)![1]!;

  const eml = readFileSync("packages/extract/fixtures/email/newsletter.eml.tmpl", "utf8").replace(/TOKEN/g, token).replace("issue-42", `issue-${Date.now()}`);
  await putObject(`inbound/e2e-${Date.now()}`, eml, "message/rfc822");
  expect((await page.request.get("/api/worker/tick", { headers: { authorization: "Bearer dev-cron-secret" } })).ok()).toBe(true);

  await page.goto("/inbox");
  const row = page.getByRole("listitem").filter({ hasText: "Writing for engineers who skim" });
  await expect(row).toContainText("Field Notes Weekly");
  await row.getByRole("link", { name: "Writing for engineers who skim" }).click();
  await expect(page.getByText("Short paragraphs are a kindness.")).toBeVisible();
  await expect(page.getByText(/Source: by email/)).toBeVisible();

  // Regenerate: a new address, the old one retired.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Regenerate address" }).click();
  await page.getByRole("button", { name: "Make a new one" }).click();
  await expect(page.locator("#email code")).not.toHaveText(address);
});
