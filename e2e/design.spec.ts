import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { signIn } from "./helpers";

// Saves signed-in pages as standalone HTML (CSS inlined, scripts removed) to test-results/design,
// so `pnpm design` can run the impeccable detector on screens it cannot sign in to. Add routes as slices land.
const FIX = "http://127.0.0.1:4180";
const OUT = "test-results/design";

test("snapshot app pages for the design detector", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await signIn(page);
  const snap = async (name: string) => {
    const html = await page.evaluate(() => {
      const css = [...document.styleSheets].map((s) => [...s.cssRules].map((r) => r.cssText).join("\n")).join("\n");
      const doc = document.documentElement.cloneNode(true) as HTMLElement;
      doc.querySelectorAll("script, link[rel=stylesheet], link[rel=preload]").forEach((n) => n.remove());
      doc.querySelector("head")!.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
      return `<!doctype html>${doc.outerHTML}`;
    });
    writeFileSync(`${OUT}/${name}.html`, html);
  };

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
  await page.goto("/later");
  await snap("later");
  await page.goto("/inbox");
  await page.keyboard.press("t");
  await snap("tag-picker");
  await page.keyboard.press("Escape");
  await box.fill("Buy an induction hob");
  await snap("paste-box-text");
});
