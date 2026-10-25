import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";

test("a product opens on its Preview: price, picture, one way out, and Show as article when the guess is wrong", async ({ page }) => {
  await signIn(page);
  const box = page.getByRole("textbox", { name: "Pluck" });
  await box.fill(`${FIX}/shop-mug.html`);
  await box.press("Enter");
  const row = page.getByRole("listitem").filter({ hasText: "Stoneware mug, sea glass" });
  await expect(row).toContainText("€24.00", { timeout: 10_000 }); // the row says the price, not a read time

  await row.getByRole("link", { name: "Stoneware mug, sea glass" }).click();
  await page.waitForURL(/\/items\//);
  await expect(page.getByRole("heading", { name: "Stoneware mug, sea glass" })).toBeVisible();
  await expect(page.getByText("€24.00", { exact: true })).toBeVisible();
  await expect(page.getByText("Thrown by hand in Wicklow.")).toBeVisible(); // what the shop says it is
  await expect(page.getByText("Add to basket")).toHaveCount(0); // never its furniture
  await expect(page.getByRole("link", { name: "Open on Kiln & Co" })).toHaveAttribute("href", `${FIX}/shop-mug.html?utm_source=getpluck.io`);
  await expect(page.getByRole("progressbar")).toHaveCount(0); // nothing to read through

  await page.getByRole("button", { name: "Show as article" }).click();
  await expect(page.getByText("the glaze pools where it likes")).toBeVisible({ timeout: 10_000 }); // read again, body kept
  await expect(page.getByRole("button", { name: "Show as preview" })).toBeVisible();
  await page.getByRole("button", { name: "Show as preview" }).click();
  await expect(page.getByRole("link", { name: "Open on Kiln & Co" })).toBeVisible();
});
