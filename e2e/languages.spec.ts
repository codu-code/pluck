import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

// German runs long and Japanese falls back to the system fonts: neither may push a page sideways on a phone.
test("home, sign-in and the Inbox fit a phone in German and Japanese", async ({ page, browser, baseURL }) => {
  const visitor = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
  await signIn(page); // in English: the helper finds its buttons by their English names
  await page.request.post("/api/v1/items", { data: { text: "Kitchen plan\nHob on the island." } });

  const fits = async (p: Page, route: string, lang: string) => {
    await p.context().addCookies([{ name: "pluck_locale", value: lang, url: baseURL! }]);
    await p.goto(route);
    await expect(p.locator("html")).toHaveAttribute("lang", lang);
    const { scroll, client } = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll, `${lang} ${route} scrolls sideways`).toBeLessThanOrEqual(client);
  };
  for (const lang of ["de", "ja"]) {
    await fits(visitor, "/", lang);
    await fits(visitor, "/signin", lang);
    await fits(page, "/inbox", lang);
  }
  await visitor.close();
});
