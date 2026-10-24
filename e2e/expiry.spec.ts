import { expect, test } from "@playwright/test";
import { ageItemsOf } from "./db";
import { signIn } from "./helpers";

test("near expiry shows a pill you can keep; Archive it all moves the old ones, and nothing is deleted", async ({ page }) => {
  const email = await signIn(page);
  for (const text of ["Ancient note", "Ageing note", "Kept for later", "Fresh note"]) await page.request.post("/api/v1/items", { data: { text } });
  const later = (await (await page.request.get("/api/v1/items?status=inbox")).json()).items.find((i: { title: string }) => i.title === "Kept for later");
  await page.request.patch(`/api/v1/items/${later.id}`, { data: { status: "later" } });
  expect(await ageItemsOf(email, ["Ageing note", "Kept for later"], 25)).toBe(2);
  expect(await ageItemsOf(email, ["Ancient note"], 40)).toBe(1);

  await page.goto("/inbox");
  const ageing = page.getByRole("listitem").filter({ hasText: "Ageing note" });
  await expect(ageing.getByRole("button", { name: /moves to the Archive soon/ })).toHaveText("30 days");
  await expect(page.getByRole("listitem").filter({ hasText: "Fresh note" }).getByRole("button", { name: /Archive soon/ })).toHaveCount(0);
  await ageing.getByRole("button", { name: /moves to the Archive soon/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Kept. The 30 days start again." })).toBeVisible();
  await expect(ageing.getByRole("button", { name: /moves to the Archive soon/ })).toHaveCount(0);

  await page.goto("/later");
  await expect(page.getByText("Kept on purpose · 1 expires this week, into the Archive")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Move everything in Inbox and Later older than 30 days to the Archive, right now. 1 item.")).toBeVisible();
  await page.getByRole("button", { name: "Archive it all. No, really." }).click();
  await expect(page.getByText("Move 1 to the Archive? Nothing is deleted.")).toBeVisible();
  await page.getByRole("button", { name: "Yes, archive them" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 item moved to the Archive. Nothing is deleted." })).toBeVisible();

  await page.getByRole("combobox", { name: "Move to Archive after" }).selectOption("never");
  await expect(page.getByRole("status").filter({ hasText: "Nothing expires now." })).toBeVisible();

  await page.goto("/archive");
  await page.getByRole("button", { name: "Expired" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Ancient note" });
  await expect(row).toContainText("archived with Archive it all");
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Back in the Inbox." })).toBeVisible();
});

test("the cron tick runs scheduled work and jobs, and refuses callers without the secret", async ({ request }) => {
  expect((await request.get("/api/worker/tick")).status()).toBe(401);
  const res = await request.get("/api/worker/tick", { headers: { authorization: "Bearer dev-cron-secret" } });
  expect(res.ok()).toBe(true);
  expect(Object.keys(await res.json()).sort()).toEqual(["expired", "purged", "ran"]);
});
