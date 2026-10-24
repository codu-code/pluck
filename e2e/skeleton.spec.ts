import { expect, test } from "@playwright/test";

test("home renders the brand and the database answers", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "pluck" })).toBeVisible();
  await expect(page.getByText("Pluck it.")).toBeVisible();
  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ ok: true });
});
