import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";

test("search finds page text, notes, tags and the Archive, and points to your AI", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.request.post("/api/v1/items", { data: { url: `${FIX}/docs-1.html` } }); // body mentions "compound index"
  const note = (await (await page.request.post("/api/v1/items", { data: { text: "Kitchen\nThe hob goes under the window." } })).json()).results[0].item;
  await page.request.post("/api/v1/tags", { data: { name: "reno" } });
  await page.request.patch(`/api/v1/items/${note.id}`, { data: { tagIds: ["reno"], status: "archived" } });

  await page.goto("/inbox");
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/search$/);
  const box = page.getByRole("searchbox", { name: "Search" });
  await expect(box).toBeFocused();

  await box.fill("compound index");
  const rows = page.getByRole("listitem");
  await expect(rows.first()).toContainText("Indexing the inbox query");
  await expect(rows.first().locator("mark")).toHaveText(/compound index/i);
  await expect(page).toHaveURL(/q=compound/);

  await box.fill("hob window");
  await expect(rows.first()).toContainText("Kitchen");
  await expect(rows.first()).toContainText("Archived");

  await box.fill("reno");
  await expect(rows).toHaveCount(1);
  await page.getByRole("combobox", { name: "Status" }).selectOption("inbox");
  await expect(page.getByText("Nothing matches “reno”.")).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("archived");
  await expect(rows).toHaveCount(1);

  await page.getByRole("button", { name: "Copy “What did I pluck about reno?”" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied." })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("What did I pluck about reno?");

  // A pasted URL finds its item.
  await page.getByRole("combobox", { name: "Status" }).selectOption("any");
  await box.fill(`${FIX}/docs-1.html?utm_source=x`);
  await expect(rows.first()).toContainText("Indexing the inbox query");
});
