import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";

test("make a list public, share it, copy it, report it, take it down", async ({ browser }) => {
  // The owner builds a list, picks a handle and flips the list to Public.
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner);
  const handle = `e2e-${Date.now().toString(36)}`;
  await owner.request.post("/api/v1/items", { data: { url: `${FIX}/news-1.html` } });
  const item = (await (await owner.request.get("/api/v1/items?status=inbox")).json()).items[0];
  const list = (await (await owner.request.post("/api/v1/lists", { data: { name: "Best MCP reading", purpose: "Start here." } })).json()).list;
  await owner.request.post(`/api/v1/lists/${list.id}/items`, { data: { itemId: item.id, note: "Read this first." } });
  await owner.request.patch(`/api/v1/lists/${list.id}/items/${item.id}`, { data: { ticked: true } });

  await owner.request.patch("/api/v1/me", { data: { handle } }); // in place of the made-up one

  await owner.goto(`/lists/${list.id}`);
  await owner.getByRole("radio", { name: "Public" }).click();
  await expect(owner.getByRole("radio", { name: "Public" })).toHaveAttribute("aria-checked", "true");
  await expect(owner.locator("code")).toContainText(`/@${handle}/best-mcp-reading`);

  // A visitor sees the public page: names, note and cover, but never the kept page text, ticks or tags.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/@${handle}/best-mcp-reading`);
  await expect(visitor.getByRole("heading", { name: "Best MCP reading" })).toBeVisible();
  await expect(visitor.getByText("Read this first.")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Small teams ship when the list is short" })).toHaveAttribute("href", `${FIX}/news-1.html`);
  await expect(visitor.locator("main ol img")).toHaveJSProperty("complete", true);
  const html = await visitor.content();
  expect(html).not.toContain("Waiting has a shape"); // a sentence from deep in the kept page
  expect(html).not.toMatch(/ticked/i);
  await expect(visitor.getByRole("checkbox")).toHaveCount(0); // the owner's mark never shows
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/); // a new list
  await owner.reload();
  await expect(owner.getByText(/1 view · only you see this/)).toBeVisible();

  // The visitor plucks the list: sign in first, then one button.
  await visitor.getByRole("link", { name: "Pluck this list" }).first().click();
  await expect(visitor).toHaveURL(/\/signin\?next=/);
  await signIn(visitor, undefined, `/copy/${list.id}`);
  await visitor.getByRole("button", { name: "Pluck this list" }).click();
  await expect(visitor.getByRole("heading", { name: /Best MCP reading/ })).toBeVisible();
  await expect(visitor.getByRole("list", { name: "Best MCP reading, in order" }).getByRole("listitem")).toHaveCount(1);
  await expect(visitor.getByText("Read this first.")).toBeVisible();

  // Someone reports it; an admin takes it down; it 404s.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`/@${handle}/best-mcp-reading`);
  await anon.getByRole("button", { name: "Report this list" }).click();
  await anon.getByRole("combobox", { name: "What is wrong?" }).selectOption("spam");
  await anon.getByRole("button", { name: "Send the report" }).click();
  await expect(anon.getByText("Thanks. A person reads every report.")).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "admin@example.test");
  await admin.goto("/admin");
  const row = admin.getByRole("row").filter({ hasText: "Best MCP reading" }).first();
  await row.getByRole("button", { name: "Take down list" }).click();
  await expect(row).toContainText("taken down");
  const gone = await anon.goto(`/@${handle}/best-mcp-reading`);
  expect(gone?.status()).toBe(404);
  await expect(anon.getByRole("heading", { name: "This List isn't public." })).toBeVisible();

  // Not an admin: /admin is a 404.
  expect((await visitor.goto("/admin"))?.status()).toBe(404);
});

test("Private again is a 404 at once", async ({ page, browser }) => {
  await signIn(page);
  await page.request.patch("/api/v1/me", { data: { handle: `p-${Date.now().toString(36)}` } });
  const me = (await (await page.request.get("/api/v1/me")).json()).me;
  const list = (await (await page.request.post("/api/v1/lists", { data: { name: "Short lived" } })).json()).list;
  expect((await page.request.patch(`/api/v1/lists/${list.id}`, { data: { visibility: "public" } })).ok()).toBe(true);
  const anon = await (await browser.newContext()).newPage();
  expect((await anon.goto(`/@${me.handle}/short-lived`))?.status()).toBe(200);
  await page.request.patch(`/api/v1/lists/${list.id}`, { data: { visibility: "private" } });
  expect((await anon.goto(`/@${me.handle}/short-lived`))?.status()).toBe(404);
});

test("a public list named in any script opens at its own address", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner);
  const handle = `e2e-${Date.now().toString(36)}`;
  await owner.request.patch("/api/v1/me", { data: { handle } });
  const item = (await (await owner.request.post("/api/v1/items", { data: { url: `${FIX}/news-2.html` } })).json()).results[0].item;
  const { list } = await (await owner.request.post("/api/v1/lists", { data: { name: "Café 東京 reading", items: [{ itemId: item.id }] } })).json();
  await owner.request.patch(`/api/v1/lists/${list.id}`, { data: { visibility: "public" } });
  const { slug } = (await (await owner.request.get(`/api/v1/lists/${list.id}`)).json()).list;
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/@${handle}/${encodeURIComponent(slug)}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Café 東京 reading");
});
