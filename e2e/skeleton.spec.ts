import { expect, test } from "@playwright/test";

test("home renders the brand and the database answers", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "pluck" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Pluck it." })).toBeVisible();
  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ ok: true });
});
