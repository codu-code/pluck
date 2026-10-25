import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail, signIn, uniqueEmail } from "./helpers";

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

test("share a List with one person, See only: the email link, their Lists, no tags, and taking it back", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner);
  await owner.request.post("/api/v1/items", { data: { url: "http://127.0.0.1:4180/news-1.html" } });
  const item = (await (await owner.request.get("/api/v1/items?status=inbox")).json()).items[0];
  const tag = (await (await owner.request.post("/api/v1/tags", { data: { name: "private-tag" } })).json()).tag;
  await owner.request.patch(`/api/v1/items/${item.id}`, { data: { tagIds: [tag.id] } });
  const list = (await (await owner.request.post("/api/v1/lists", { data: { name: "Holiday ideas", purpose: "Somewhere warm." } })).json()).list;
  await owner.request.post(`/api/v1/lists/${list.id}/items`, { data: { itemId: item.id, note: "Book early." } });

  const friend = uniqueEmail("friend");
  await owner.goto(`/lists/${list.id}`);
  const sent = Date.now();
  await owner.getByLabel("Share with someone: their email").fill(friend);
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await expect(owner.getByRole("list", { name: "People who can see it" })).toContainText(friend);

  // The email's link signs them in and opens the List.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(await linkFromEmail(friend, sent));
  await signIn(visitor, friend, `/shared/${list.id}`);
  await expect(visitor.getByRole("heading", { name: "Holiday ideas" })).toBeVisible();
  await expect(visitor.getByText("Book early.")).toBeVisible();
  await expect(visitor.getByText("private-tag")).toHaveCount(0);
  await visitor.goto("/lists");
  await expect(visitor.getByRole("region", { name: "Shared with you" })).toContainText("Holiday ideas");

  // Someone else signed in cannot open it.
  const stranger = await (await browser.newContext()).newPage();
  await signIn(stranger);
  expect((await stranger.request.get(`/api/v1/shared/${list.id}`)).status()).toBe(404);
  await stranger.goto(`/shared/${list.id}`);
  await expect(stranger.getByRole("heading", { name: "Not shared with you." })).toBeVisible();
  await expect(stranger.getByRole("button", { name: "Use another email" })).toBeVisible();

  // The owner takes it back; it is gone for them at once.
  await owner.getByRole("button", { name: `Stop sharing with ${friend}` }).click();
  expect((await visitor.request.get(`/api/v1/shared/${list.id}`)).status()).toBe(404);
});
