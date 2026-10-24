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
  await page.goto("/signin");
});
