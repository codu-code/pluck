import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const picker = (page: Page) => page.getByRole("dialog", { name: /Add .*to a list/ });

async function notes(page: Page, texts: string[]) {
  for (const text of texts) expect((await page.request.post("/api/v1/items", { data: { text } })).ok()).toBe(true);
}

test("build an ordered list from the Inbox, then tick, note, reorder, export and delete it", async ({ page }) => {
  await signIn(page);
  await notes(page, ["Demo three", "Demo two", "Demo one"]); // newest first in the Inbox: one, two, three
  await page.goto("/inbox");
  await expect(page.getByRole("listitem")).toHaveCount(3); // hydrated, keys are live

  await page.keyboard.press("a");
  await picker(page).getByRole("combobox", { name: "List" }).fill("Talk on MCP auth");
  await page.keyboard.press("Enter"); // "New list “Talk on MCP auth”"
  await expect(page.getByRole("status").filter({ hasText: "Added to “Talk on MCP auth”." })).toBeVisible();
  await page.keyboard.press("Escape");
  for (const _ of [1, 2]) {
    await page.keyboard.press("j");
    await page.keyboard.press("a");
    // Wait for the add itself: the Lists page renders on the server and would miss one still in flight.
    await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/lists\/[^/]+\/items$/.test(new URL(r.url()).pathname) && r.request().method() === "POST"),
      picker(page).getByRole("option", { name: /Talk on MCP auth/ }).click(),
    ]);
    await page.keyboard.press("Escape");
  }

  await page.getByRole("link", { name: /^Lists/ }).click();
  const row = page.getByRole("row").filter({ hasText: "Talk on MCP auth" });
  await expect(row).toContainText("0 of 3");
  await row.getByRole("link", { name: "Talk on MCP auth" }).click();
  const items = page.getByRole("list", { name: "Talk on MCP auth, in order" }).getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Demo one");

  await page.keyboard.press(" ");
  await expect(page.getByText("1 of 3 ticked")).toBeVisible();
  await page.keyboard.press("n");
  await page.getByRole("textbox", { name: "Note on Demo one in this list" }).fill("Open with this");
  await page.keyboard.press("Enter");
  await expect(items.nth(0)).toContainText("Open with this");
  await page.keyboard.press("Shift+J");
  await expect(items.nth(1)).toContainText("Demo one");

  // Drag the last row to the top.
  await items.nth(2).getByRole("button", { name: /Drag to reorder/ }).dragTo(items.nth(0));
  await expect(items.nth(0)).toContainText("Demo three");

  await page.reload();
  await expect(items.nth(0)).toContainText("Demo three");
  await expect(items.nth(1)).toContainText("Demo two");
  await expect(items.nth(2)).toContainText("Open with this");
  await expect(page.getByRole("checkbox", { name: "Tick Demo one" })).toBeChecked();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this list" }).click();
  const md = readFileSync(await (await download).path(), "utf8");
  expect(md).toContain("# Talk on MCP auth");
  expect(md).toContain("3. ~~Demo one~~\n   Open with this");

  // The item page shows the list, with the item's place in it.
  await items.nth(2).getByRole("link", { name: "Demo one" }).click();
  await expect(page.getByText("In 1 list")).toBeVisible();
  await expect(page.getByRole("link", { name: /Talk on MCP auth Private · #3/ })).toBeVisible();
  await page.goBack();

  // Take one out; it stays in the library. Then delete the list.
  await items.nth(0).hover();
  await items.nth(0).getByRole("button", { name: "Take out" }).click();
  await expect(items).toHaveCount(2);
  await page.goto("/search?q=demo");
  await page.getByRole("combobox", { name: "List" }).selectOption({ label: "Talk on MCP auth" });
  await expect(page.getByText("2 results")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "Delete this list" }).click();
  await page.getByRole("button", { name: "Yes, delete the list" }).click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("No lists yet.")).toBeVisible();
});
