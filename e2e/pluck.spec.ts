import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";

test("pluck a URL: the row lands, then the title and cover fill in", async ({ page }) => {
  await signIn(page);
  const box = page.getByRole("textbox", { name: "Pluck" });
  await box.fill(`${FIX}/news-2.html`);
  await box.press("Enter");

  const rows = page.getByRole("listitem");
  await expect(rows.first()).toBeVisible({ timeout: 1000 }); // acknowledged before the server answers
  await expect(rows.first().getByRole("link", { name: "Why the slowest releases are mostly waiting" })).toBeVisible();
  await expect(rows.first()).toContainText("The Example Times");
  await expect(rows.first().locator("img")).toHaveJSProperty("complete", true, { timeout: 10_000 });
  expect(await rows.first().locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Re-pluck: same item, moved to the top, never twice.
  await box.fill(`${FIX}/blog-3.html`);
  await box.press("Enter");
  await expect(rows.first()).toContainText("Drop D, slowly");
  await box.fill(`${FIX}/news-2.html?utm_campaign=again`);
  await box.press("Enter");
  await expect(rows.first()).toContainText("Why the slowest releases");
  await expect(rows).toHaveCount(2);
  await page.reload();
  await expect(rows).toHaveCount(2);
});

test("a page that cannot be read says so and offers Retry, the original and the Wayback copy", async ({ page }) => {
  await signIn(page);
  const box = page.getByRole("textbox", { name: "Pluck" });
  await box.fill(`${FIX}/gone.html`);
  await box.press("Enter");
  const row = page.getByRole("listitem").first();
  await expect(row).toContainText("Couldn't read");
  await row.getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Couldn't read this page." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open original" })).toHaveAttribute("href", `${FIX}/gone.html?utm_source=getpluck.io`);
  await expect(page.getByRole("link", { name: "Try the Wayback copy" })).toHaveAttribute("href", `https://web.archive.org/web/*/${FIX}/gone.html`);
});

test("a URL that is not a link is refused with a readable message", async ({ page }) => {
  await signIn(page);
  const res = await page.request.post("/api/v1/items", { data: { url: "javascript:alert(1)" } });
  expect(res.status()).toBe(400);
  expect(await res.json()).toEqual({ results: [], rejected: [{ input: "javascript:alert(1)", message: "That is not a link Pluck can open." }] });
  const anon = await page.context().request.fetch("/api/v1/items", { method: "POST", data: { url: "https://example.com" }, headers: { cookie: "" } });
  expect(anon.status()).toBe(401);
});

test("a share from Android is plucked on arrival; a link to /share, or a form on another site, only fills the box", async ({ page, baseURL }) => {
  await signIn(page);
  // The installed app's share sheet posts what was shared.
  const shared = await page.request.post("/share", { form: { title: "Worth a read", text: `Worth a read ${FIX}/news-2.html` }, maxRedirects: 0 });
  expect([shared.status(), shared.headers().location]).toEqual([303, `${baseURL}/inbox`]);
  await page.goto("/inbox");
  const rows = page.getByRole("listitem");
  await expect(rows.first().getByRole("link", { name: "Why the slowest releases are mostly waiting" })).toBeVisible();
  await expect(rows).toHaveCount(1);

  // Another site posts a form here for the signed-in person: nothing is plucked.
  await page.goto(`${FIX}/news-1.html`);
  await page.evaluate(([to, link]) => {
    const form = Object.assign(document.createElement("form"), { method: "post", action: to });
    form.append(Object.assign(document.createElement("input"), { name: "text", value: link }));
    document.body.append(form);
    form.submit();
  }, [`${baseURL}/share`, `${FIX}/blog-2.html`]);
  await expect(page).toHaveURL(/\/share\/add\?text=/);
  expect((await (await page.request.get("/api/v1/items?status=inbox")).json()).items).toHaveLength(1);

  // A link to /share opens the box holding the link; nothing is plucked until they press Pluck it.
  await page.goto(`/share?${new URLSearchParams({ text: `${FIX}/blog-3.html` })}`);
  await expect(page).toHaveURL(/\/share\/add\?text=/);
  await expect(page.getByRole("textbox", { name: "Pluck" })).toHaveValue(`${FIX}/blog-3.html`);
  expect((await (await page.request.get("/api/v1/items?status=inbox")).json()).items).toHaveLength(1);
  await page.getByRole("button", { name: "Pluck it" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(rows.first()).toContainText("Drop D, slowly");
  await expect(rows).toHaveCount(2);
});
