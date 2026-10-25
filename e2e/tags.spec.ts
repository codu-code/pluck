import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const rows = (page: Page) => page.getByRole("listitem");
const picker = (page: Page) => page.getByRole("dialog", { name: /^Tag/ });

async function notes(page: Page, texts: string[]) {
  for (const text of texts) expect((await page.request.post("/api/v1/items", { data: { text } })).ok()).toBe(true);
}

test("make a tag with t, see it on the row, filter by it, bulk tag", async ({ page }) => {
  await signIn(page);
  await notes(page, ["Window functions", "Index notes", "Guitar practice"]);
  await page.goto("/inbox");
  await expect(rows(page)).toHaveCount(3); // hydrated, keys are live
  await page.keyboard.press("t"); // cursor on the newest: Guitar practice
  await picker(page).getByRole("combobox", { name: "Tag" }).fill("Postgres");
  await expect(picker(page).getByRole("option", { name: "Create “Postgres”" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker(page).getByRole("option", { name: /Postgres/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("j"); // move off, so the first row shows chips instead of actions
  await expect(rows(page).first().getByRole("button", { name: "Show only Postgres" })).toBeVisible();

  // Bulk: the other two.
  await page.keyboard.press("x");
  await page.keyboard.press("j");
  await page.keyboard.press("x");
  await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Tag" }).click();
  await expect(picker(page)).toHaveAccessibleName("Tag 2 items");
  await picker(page).getByRole("option", { name: /Postgres/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show only Postgres" })).toHaveCount(3);

  await page.getByRole("button", { name: "Show only Postgres" }).first().click();
  await expect(page.getByRole("button", { name: "Stop filtering by Postgres" })).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Stop filtering by Postgres" }).click();
  await expect(rows(page)).toHaveCount(3);
});

test("tag on the item page, and an unknown tag is a 422 with the nearest", async ({ page }) => {
  await signIn(page);
  const res = await page.request.post("/api/v1/items", { data: { text: "Kitchen plan" } });
  const id = (await res.json()).results[0].item.id;
  expect((await page.request.post("/api/v1/tags", { data: { name: "kitchen" } })).status()).toBe(201);

  const bad = await page.request.patch(`/api/v1/items/${id}`, { data: { tagIds: ["kitchn"] } });
  expect(bad.status()).toBe(422);
  const body = await bad.json();
  expect(body.error.code).toBe("unknown_tags");
  expect(body.error.details.nearest[0].name).toBe("kitchen");

  await page.goto(`/items/${id}`);
  await page.getByRole("button", { name: /Add tag/ }).click();
  await picker(page).getByRole("option", { name: /kitchen/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Remove tag kitchen" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Remove tag kitchen" }).click();
  await expect(page.getByRole("button", { name: "Remove tag kitchen" })).toHaveCount(0);
});

test("Settings: rename, merge and delete tags", async ({ page }) => {
  await signIn(page);
  const ids = [];
  for (const text of ["One", "Two"]) ids.push((await (await page.request.post("/api/v1/items", { data: { text } })).json()).results[0].item.id);
  await page.request.post("/api/v1/tags", { data: { name: "pg" } });
  await page.request.post("/api/v1/tags", { data: { name: "postgres" } });
  await page.request.patch(`/api/v1/items/${ids[0]}`, { data: { tagIds: ["pg"] } });
  await page.request.patch(`/api/v1/items/${ids[1]}`, { data: { tagIds: ["postgres"] } });

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Remove everything AI tagged this week · 0" })).toBeDisabled();
  const pg = page.getByRole("row").filter({ hasText: /^pg/ });
  await pg.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "New name for pg" }).fill("postgres");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already" })).toHaveText('There is already a tag called "postgres". Merge them instead.');
  await page.keyboard.press("Escape");

  await pg.getByRole("button", { name: "Merge" }).click();
  await page.getByRole("combobox", { name: "Merge pg into" }).selectOption({ label: "postgres" });
  await pg.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Merged “pg” into “postgres”." })).toBeVisible();
  const postgres = page.getByRole("row").filter({ hasText: "postgres" });
  await expect(postgres.getByRole("cell").nth(1)).toHaveText("2");

  await postgres.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete the tag" }).click();
  await expect(page.getByText("No tags yet. Press t on any item to make one.")).toBeVisible();
});
