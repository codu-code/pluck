import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

const FIX = "http://127.0.0.1:4180";

test("a visitor pastes links on the home page, signs up, and finds them in the Inbox", async ({ page }) => {
  await page.goto("/");
  const box = page.getByLabel("Paste a link to try it");
  await box.fill("hello there");
  await box.press("Enter");
  await expect(page.getByText("Paste a link that starts with http, or www.")).toBeVisible();
  await box.fill(`Two for later: ${FIX}/news-1.html and ${FIX}/docs-1.html`);
  await page.getByRole("button", { name: "Pluck it" }).click();
  await expect(page.getByRole("status")).toContainText(/Plucked\.\s*That was \d+ ms\./);
  await box.fill(`${FIX}/news-2.html`);
  await box.press("Enter");
  await expect(page.getByRole("status")).toContainText("Plucked.");

  await page.getByRole("link", { name: "Sign up to keep it" }).click();
  await signIn(page, uniqueEmail("visitor"));
  await expect(page.getByRole("link", { name: "Small teams ship when the list is short" }).first()).toBeVisible();
  await expect.poll(async () => ((await (await page.request.get("/api/v1/items?status=inbox")).json()).items as unknown[]).length).toBe(3);
  expect((await page.context().cookies()).some((c) => c.name === "pluck_try")).toBe(false);
});

test("signed in, the paste box plucks straight into the Inbox", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const box = page.getByLabel("Paste a link to try it");
  await box.fill(`${FIX}/news-1.html`);
  await box.press("Enter");
  await expect(page.getByRole("status")).toContainText("It's in your Inbox.");
  await expect.poll(async () => ((await (await page.request.get("/api/v1/items?status=inbox")).json()).items as unknown[]).length).toBe(1);
});

test("the site: connect your AI with tabs, open source, privacy and terms", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Connect your AI" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ready for your AI. Whichever one you use.");
  const panel = page.getByRole("tabpanel");
  await expect(panel.locator("code")).toHaveText("http://127.0.0.1:3300/mcp");
  await page.getByRole("tab", { name: "Claude Code" }).click();
  await expect(panel.locator("code")).toHaveText("claude mcp add --transport http pluck http://127.0.0.1:3300/mcp");
  await expect(page.getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("code", { hasText: "search_items" })).toBeVisible();

  await page.getByRole("link", { name: "Open source" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Yours.");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
  await expect(page.getByRole("heading", { name: "Cookies and analytics" })).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pluck it.");
});

test("support: answers by topic, and bugs go to GitHub issues", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Support" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Help.");
  await page.getByRole("navigation", { name: "Topics" }).getByRole("link", { name: "Your AI" }).click();
  await expect(page).toHaveURL(/#ai$/);
  await expect(page.getByRole("heading", { name: "How do I disconnect it?" })).toBeInViewport();
  for (const topic of ["The extension", "iPhone", "Your AI", "Your library and account", "Running your own"])
    await expect(page.getByRole("heading", { level: 2, name: topic })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open an issue" })).toHaveAttribute("href", /\/issues$/);
  await page.getByRole("link", { name: "Connect your AI" }).last().click();
  await expect(page).toHaveURL(/\/connect$/);
});
