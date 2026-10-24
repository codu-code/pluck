import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";
const box = (page: Page) => page.getByRole("textbox", { name: "Pluck" });
const rows = (page: Page) => page.getByRole("listitem");

test("a block of links shows the count first, then makes one row per link", async ({ page }) => {
  await signIn(page);
  await box(page).fill(`Reading for the week: ${FIX}/news-3.html, ${FIX}/docs-1.html and ${FIX}/blog-2.html.`);
  await expect(page.getByText("3 links. Enter plucks them all.")).toBeVisible();
  await box(page).press("Enter");
  await expect(rows(page)).toHaveCount(3);
  for (const title of ["Free services need honest rate limits", "Indexing the inbox query", "A kitchen plan in three drafts"])
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 15_000 });
});

test("a sentence becomes a Note you can open and keep writing", async ({ page }) => {
  await signIn(page);
  await box(page).fill("An MCP server for estimates");
  await expect(page.getByRole("radio", { name: "Note" })).toHaveAttribute("aria-checked", "true");
  await box(page).press("Enter");
  const row = rows(page).first();
  await expect(row).toContainText("Note · by you");
  await row.getByRole("link", { name: "An MCP server for estimates" }).click();

  const body = page.getByRole("textbox", { name: "Body" });
  await expect(body).toHaveValue("An MCP server for estimates");
  await body.fill("Estimates over MCP\nRead-only tools first.\nThen one write tool behind a confirm.");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Body" })).toHaveValue(/Then one write tool/);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Estimates over MCP");

  await page.getByRole("combobox", { name: "Kind" }).selectOption("todo");
  await page.getByLabel("Due", { exact: true }).fill("2026-11-03");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(rows(page).first()).toContainText("Estimates over MCP");
  await expect(rows(page).first()).toContainText(/Todo · (due|overdue)/);
});

test("pick Todo with a due date in the paste box, and filter by kind", async ({ page }) => {
  await signIn(page);
  await box(page).fill(`${FIX}/youtube-1.html`);
  await box(page).press("Enter");
  await expect(page.getByRole("link", { name: "Postgres indexes in 40 minutes" })).toBeVisible();

  await box(page).fill("Learn window functions");
  await page.getByRole("radio", { name: "Todo" }).click();
  await page.getByLabel("Due", { exact: true }).fill("2026-11-06");
  await box(page).press("Enter");
  await expect(rows(page).first()).toContainText(/Todo · (due|overdue)/);

  await page.getByRole("button", { name: "Todos" }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Links" }).click();
  await expect(page.getByRole("button", { name: "Watch" })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Postgres indexes");
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.getByText("Nothing of this kind in the Inbox.")).toBeVisible();
  await page.getByRole("button", { name: "All" }).click();
  await expect(rows(page)).toHaveCount(2);
});
