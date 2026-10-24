import { test } from "@playwright/test";
import { signIn, snapshot } from "./helpers";

// Saves signed-in pages for `pnpm design` (see snapshot in helpers.ts). Add routes as slices land.
const FIX = "http://127.0.0.1:4180";

test("snapshot app pages for the design detector", async ({ page }) => {
  await signIn(page);
  const snap = (name: string) => snapshot(page, name);

  await snap("inbox-empty");
  const box = page.getByRole("textbox", { name: "Pluck" });
  for (const p of ["news-1", "docs-1", "gone"]) {
    await box.fill(`${FIX}/${p}.html`);
    await box.press("Enter");
    await page.waitForResponse((r) => r.url().endsWith("/api/v1/items") && r.request().method() === "POST");
  }
  await page.waitForTimeout(1500);
  await snap("inbox");
  await page.getByRole("link", { name: "gone.html" }).first().click().catch(async () => {
    await page.getByRole("listitem").filter({ hasText: "Couldn't read" }).getByRole("link").first().click();
  });
  await page.waitForURL(/\/items\//);
  await snap("item-failed");
  await page.goto("/inbox");
  await page.getByRole("link", { name: "Small teams ship when the list is short" }).first().click();
  await page.waitForURL(/\/items\//);
  await page.waitForSelector("article p");
  await snap("reader");
  await page.goto("/inbox");
  await page.keyboard.press("x");
  await snap("inbox-bulk");
  await page.keyboard.press("Escape");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "PATCH"), page.keyboard.press("e")]);
  await page.goto("/archive");
  await snap("archive");
  await page.goto("/inbox");
  await box.fill("Kitchen plan\nHob on the island.");
  await box.press("Enter");
  await page.getByRole("link", { name: "Kitchen plan" }).first().click();
  await page.waitForURL(/\/items\//);
  await snap("note-editor");
  const made = await page.request.post("/api/v1/lists", { data: { name: "Best MCP reading", purpose: "Start here. Best first." } });
  const listId = (await made.json()).list.id;
  const ids = (await (await page.request.get("/api/v1/items?status=inbox")).json()).items.slice(0, 3).map((i: { id: string }) => i.id);
  await page.request.post(`/api/v1/lists/${listId}/items`, { data: { itemIds: ids } });
  await page.request.patch(`/api/v1/lists/${listId}/items/${ids[0]}`, { data: { ticked: true, note: "Start here." } });
  await page.goto("/lists");
  await snap("lists");
  await page.request.patch("/api/v1/me", { data: { handle: `d-${Date.now().toString(36)}` } });
  await page.request.patch(`/api/v1/lists/${listId}`, { data: { visibility: "public" } });
  await page.goto(`/lists/${listId}`);
  await snap("list");
  const handle = (await (await page.request.get("/api/v1/me")).json()).me.handle;
  await page.goto(`/@${handle}/best-mcp-reading`);
  await snap("public-list");
  await page.goto("/search?q=teams");
  await page.waitForSelector("mark");
  await snap("search");
  await page.goto("/settings");
  await snap("settings");
  const reg = await page.request.post("/api/auth/oauth2/register", {
    headers: { origin: new URL(page.url()).origin }, // signed in, so Better Auth checks the origin
    data: { client_name: "Test AI", redirect_uris: [`${FIX}/callback`], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] },
  });
  const consent = new URLSearchParams({
    response_type: "code", client_id: (await reg.json()).client_id, redirect_uri: `${FIX}/callback`, state: "s", scope: "library:read library:write",
    code_challenge: "x".repeat(43), code_challenge_method: "S256", resource: `${new URL(page.url()).origin}/mcp`,
  });
  await page.goto(`/api/auth/oauth2/authorize?${consent}`);
  await page.waitForURL(/\/oauth\/consent/);
  await snap("consent");
  await page.goto("/later");
  await snap("later");
  await page.goto("/inbox");
  await page.keyboard.press("t");
  await snap("tag-picker");
  await page.keyboard.press("Escape");
  await box.fill("Buy an induction hob");
  await snap("paste-box-text");
});
