import { expect, test, type Page } from "@playwright/test";
import es from "../packages/i18n/messages/app/es.json" with { type: "json" };
import fr from "../packages/i18n/messages/app/fr.json" with { type: "json" };
import { signIn, snapshot } from "./helpers";

// The language the service worker kept the offline page in (public/sw.js).
const keptIn = (page: Page) => page.evaluate(async () => (await (await caches.match("/__pluck/locale"))?.text()) ?? null);

test("offline: the nav says so, and the offline page is in your language, kept again when you change it", async ({ page, context, baseURL }) => {
  await signIn(page); // in English: the helper finds its buttons by their English names
  await context.addCookies([{ name: "pluck_locale", value: "fr", url: baseURL! }]);
  await page.goto("/inbox");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => keptIn(page)).toBe("fr");

  // The connection drops: a mark in the nav, beside the bar that says plucks will sync.
  const nav = page.getByRole("navigation", { name: fr.shell.main });
  await expect(nav.getByText(fr.shell.offline)).toHaveCount(0);
  await context.setOffline(true);
  await expect(nav.getByText(fr.shell.offline)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: fr.offlineBar.text })).toBeVisible();

  // A page never opened: the offline page, in French, styled from what the worker kept on the first visit.
  await page.goto("/later");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(fr.offline.title1);
  await expect(page.getByText(fr.offline.lede)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(246, 248, 244)");
  await context.setOffline(false);
  await snapshot(page, "offline");

  await page.goto("/inbox");
  await context.setOffline(true);
  await expect(nav.getByText(fr.shell.offline)).toBeVisible();
  await snapshot(page, "inbox-offline");
  await context.setOffline(false);
  await expect(nav.getByText(fr.shell.offline)).toHaveCount(0);

  // Spanish from Settings: the kept offline page follows.
  await page.goto("/settings");
  await page.getByLabel(fr.language.label, { exact: true }).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect.poll(() => keptIn(page)).toBe("es");
  await context.setOffline(true);
  await page.goto("/later");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(es.offline.title1);
  await expect(page.getByRole("button", { name: es.offline.tryAgain })).toBeVisible();
  await context.setOffline(false);
});
