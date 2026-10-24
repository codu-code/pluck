import { chromium, expect, test as base, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { signIn, snapshot } from "./helpers";

// The extension, loaded unpacked into Chromium, against the e2e server. Built by the webServer command
// with PLUCK_LOCAL=1, so it may talk to 127.0.0.1.
const BASE = "http://127.0.0.1:3300";
const FIX = "http://127.0.0.1:4180";
const PATH = "apps/extension/.output/chrome-mv3";

const test = base.extend<{ context: BrowserContext; sw: Worker; extId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      baseURL: BASE,
      args: [`--disable-extensions-except=${PATH}`, `--load-extension=${PATH}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => use(context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))),
  extId: async ({ sw }, use) => use(new URL(sw.url()).host),
});

type Hooks = { pluckTest: { menu: (info: object, tab?: object) => Promise<unknown>; drain: () => Promise<number> } };

// Points the extension at the e2e server with a personal API key (the self-host path).
async function useKey(page: Page, sw: Worker): Promise<string> {
  const email = await signIn(page);
  const { key } = (await (await page.request.post("/api/v1/api-keys", { data: { name: "Extension" } })).json()) as { key: string };
  await sw.evaluate(async ({ key, server }) => {
    await chrome.storage.local.set({ settings: { server, defaultKind: "guess", sendContent: true, transcripts: true }, apiKey: key, seenTips: true });
  }, { key, server: BASE });
  return email;
}

// The popup, opened as a page for the given tab.
async function popupFor(context: BrowserContext, sw: Worker, extId: string, url: string): Promise<Page> {
  const tabId = await sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]!.id!, url);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
  return popup;
}

const itemsOf = async (page: Page, status = "inbox") =>
  ((await (await page.request.get(`/api/v1/items?status=${status}`)).json()) as { items: { id: string; title: string; source: string; status: string; note: string | null; tagIds: string[] }[] }).items;

test("the popup plucks the page with what the browser rendered, then tags, notes, lists and moves it", async ({ context, sw, extId, page }) => {
  await useKey(page, sw);
  await page.request.post("/api/v1/tags", { data: { name: "teams" } });
  await page.request.post("/api/v1/lists", { data: { name: "Reading for the talk" } });

  const article = await context.newPage();
  await article.goto(`${FIX}/news-1.html`);
  const popup = await popupFor(context, sw, extId, `${FIX}/news-1.html`);
  await expect(popup.getByRole("status")).toHaveText("Plucked");
  await expect(popup.getByText("Small teams ship when the list is short")).toBeVisible();
  const [item] = await itemsOf(page);
  expect(item).toMatchObject({ title: "Small teams ship when the list is short", source: "extension" });
  expect((await (await page.request.get(`/api/v1/items/${item!.id}?include=text`)).json()).text).toContain("finishing problem");

  await snapshot(popup, "extension-popup");
  await popup.getByRole("button", { name: "teams" }).click();
  await expect(popup.getByRole("button", { name: "teams" })).toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("button", { name: "Watch" }).click();
  await expect(popup.getByRole("button", { name: "Watch" })).toHaveAttribute("aria-pressed", "true");
  await expect(popup.getByRole("button", { name: "Note" })).toBeDisabled();
  await popup.getByPlaceholder("A note, if you like").fill("for the talk");
  await popup.getByPlaceholder("A note, if you like").press("Enter");
  await popup.getByLabel("To list").selectOption({ label: "Reading for the talk" });
  await expect.poll(async () => (await itemsOf(page))[0]?.note).toBe("for the talk");
  const lists = (await (await page.request.get("/api/v1/lists")).json()).lists as { itemCount: number }[];
  expect(lists[0]!.itemCount).toBe(1);
  expect(await sw.evaluate(async (tabId) => chrome.action.getBadgeText({ tabId }), await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1:4180/news-1.html" }))[0]!.id!))).toBe("✓");

  // Opening it again shows the item instead of plucking a second one; Later moves it.
  await popup.close();
  const again = await popupFor(context, sw, extId, `${FIX}/news-1.html`);
  await expect(again.getByText(/^Plucked .* · Inbox$/)).toBeVisible();
  await expect(again.getByText("teams", { exact: true })).toBeVisible();
  await again.getByRole("button", { name: "Pluck it again" }).click();
  await again.getByRole("button", { name: "Later" }).click();
  await expect.poll(async () => (await itemsOf(page, "later")).length).toBe(1);
  expect(await itemsOf(page)).toHaveLength(0);
});

test("the right-click menu plucks a link, an image and a selection as a highlight", async ({ context, sw, page }) => {
  await useKey(page, sw);
  const article = await context.newPage();
  await article.goto(`${FIX}/news-1.html`);
  const hooks = (info: object, tab?: object) => sw.evaluate(({ info, tab }) => (globalThis as unknown as Hooks).pluckTest.menu(info, tab), { info, tab });
  await hooks({ menuItemId: "pluck-link", linkUrl: `${FIX}/docs-1.html` });
  await hooks({ menuItemId: "pluck-image", srcUrl: `${BASE}/icon-192.png` });

  await article.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((x) => x.textContent?.includes("finishing problem"))!;
    const range = document.createRange();
    range.selectNodeContents(p);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  const tab = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1:4180/news-1.html" }))[0]);
  await hooks({ menuItemId: "pluck-selection" }, tab);

  const items = await itemsOf(page);
  expect(items.map((i) => i.title).sort()).toEqual(expect.arrayContaining(["Small teams ship when the list is short"]));
  expect(items).toHaveLength(3);
  const article1 = items.find((i) => i.title === "Small teams ship when the list is short")!;
  const { highlights } = (await (await page.request.get(`/api/v1/items/${article1.id}?include=highlights`)).json()) as { highlights: { quote: string }[] };
  expect(highlights[0]?.quote).toContain("finishing problem");
});

test("a video page's captions are kept with the page text", async ({ context, sw, extId, page }) => {
  await useKey(page, sw);
  const video = await context.newPage();
  await video.goto(`${FIX}/video-watch.html?v=abc123`);
  const popup = await popupFor(context, sw, extId, `${FIX}/video-watch.html?v=abc123`);
  await expect(popup.getByRole("status")).toHaveText("Plucked");
  const [item] = await itemsOf(page);
  expect((await (await page.request.get(`/api/v1/items/${item!.id}?include=text`)).json()).text).toContain("## Transcript\n\nWelcome back. Today we estimate in days, not points.");
});

test("offline, a pluck waits in the queue with a dot on the badge, and goes once the server is back", async ({ context, sw, extId, page }) => {
  await useKey(page, sw);
  await sw.evaluate(() => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, server: "http://127.0.0.1:3399" } })));
  const article = await context.newPage();
  await article.goto(`${FIX}/docs-1.html`);
  const popup = await popupFor(context, sw, extId, `${FIX}/docs-1.html`);
  await expect(popup.getByText("Couldn't reach Pluck. Will retry.")).toBeVisible();
  await expect(popup.getByText("1 pluck queued on this browser.")).toBeVisible();
  expect(await sw.evaluate(() => chrome.action.getBadgeText({}))).toBe("•");

  await sw.evaluate((server) => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, server } })), BASE);
  expect(await sw.evaluate(() => (globalThis as unknown as Hooks).pluckTest.drain())).toBe(0);
  expect(await sw.evaluate(() => chrome.action.getBadgeText({}))).toBe("");
  expect((await itemsOf(page)).map((i) => i.source)).toEqual(["extension"]);
});

test("signing in with OAuth: consent once, then the popup plucks with the app's token", async ({ context, sw, extId, page }) => {
  await signIn(page);
  await sw.evaluate((server) => chrome.storage.local.set({ settings: { server, defaultKind: "guess", sendContent: true, transcripts: true } }), BASE);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`);
  await expect(options.getByText("Not signed in")).toBeVisible();
  await snapshot(options, "extension-options");
  const consentTab = context.waitForEvent("page");
  await options.getByRole("button", { name: "Sign in" }).click();
  const consent = await consentTab;
  await expect(consent.getByRole("heading", { name: "Pluck for your browser wants to use your Pluck" })).toBeVisible();
  await expect(consent.getByText("It plucks and organises as you, from this device.")).toBeVisible();
  await consent.getByRole("button", { name: "Allow" }).click();
  await expect(consent.getByRole("heading", { name: "You can pluck from your browser now." })).toBeVisible();
  await snapshot(consent, "extension-connected");
  await expect(options.getByText(/@example\.test/)).toBeVisible();

  const article = await context.newPage();
  await article.goto(`${FIX}/news-2.html`);
  const popup = await popupFor(context, sw, extId, `${FIX}/news-2.html`);
  await expect(popup.getByRole("status")).toHaveText("Plucked");
  expect(await itemsOf(page)).toHaveLength(1);

  // The connection shows in Settings and can be cut off there.
  await page.goto("/settings");
  await expect(page.locator("#ai").getByText("Pluck for your browser")).toBeVisible();

  // Signing out revokes the refresh token and the popup asks to sign in again.
  await options.getByRole("button", { name: "Sign out" }).click();
  const after = await popupFor(context, sw, extId, `${FIX}/news-2.html`);
  await expect(after.getByRole("button", { name: "Sign in" })).toBeVisible();
});
