import { expect, test } from "@playwright/test";
import { linkFromEmail, signIn } from "./helpers";


test("an API key works from a script, cannot manage keys or delete, and stops when revoked", async ({ page, playwright }) => {
  await signIn(page);
  await page.goto("/settings#keys");
  await page.getByRole("button", { name: "New key" }).click();
  await page.getByRole("textbox", { name: "Name for the key" }).fill("Claude Code");
  await page.getByRole("button", { name: "Make the key" }).click();
  const key = (await page.locator("#keys code").textContent())!;
  expect(key).toMatch(/^pk_live_/);

  const script = await playwright.request.newContext({ baseURL: page.url().split("/settings")[0], extraHTTPHeaders: { authorization: `Bearer ${key}` } });
  const made = await script.post("/api/v1/items", { data: { text: "From a script" } });
  expect(made.status()).toBe(201);
  const id = (await made.json()).results[0].item.id;
  expect((await script.get("/api/v1/items?status=inbox")).ok()).toBe(true);
  expect((await script.get("/api/v1/api-keys")).status()).toBe(403);
  expect((await script.delete(`/api/v1/items/${id}`)).status()).toBe(403);

  await page.reload();
  await expect(page.locator("#keys")).toContainText("used now");
  await page.locator("#keys").getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("status").filter({ hasText: "revoked" })).toBeVisible();
  expect((await script.get("/api/v1/items?status=inbox")).status()).toBe(401);
});

test("import a Pocket file, export everything, sign out, delete the account", async ({ page }) => {
  const email = await signIn(page);
  await page.goto("/settings#import");
  await page.getByLabel("Import file").setInputFiles("packages/extract/fixtures/imports/pocket.csv");
  await expect(page.getByText("Done. Imported items are in your Archive under Imported, still searchable.")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#import")).toContainText("3 done");
  await page.goto("/archive");
  await page.getByRole("button", { name: "Imported" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(3);

  // Export: the link arrives by email (the worker runs on the tick).
  await page.goto("/settings#import");
  const sent = Date.now();
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The link arrives by email" })).toBeVisible();
  const link = await linkFromEmail(email, sent);
  const zip = await page.request.get(link);
  expect(zip.ok()).toBe(true);
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");

  // Sign out leaves this browser clean.
  await page.evaluate(() => localStorage.setItem("pluck:queue", "[]"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  expect(await page.evaluate(() => localStorage.getItem("pluck:queue"))).toBeNull();
  await page.goto("/inbox");
  await expect(page).toHaveURL(/\/signin$/);

  // Delete: type the email, everything goes; signing in again starts empty.
  await signIn(page, email);
  await page.goto("/settings#delete");
  await page.getByRole("button", { name: "Delete everything. No, really." }).click();
  await expect(page.getByRole("button", { name: "Delete everything now" })).toBeDisabled();
  await page.getByLabel(`Type ${email} to confirm`).fill(email);
  await page.getByRole("button", { name: "Delete everything now" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Nothing plucked yet." })).toBeVisible();
});
