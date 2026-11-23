// The Chrome Web Store's three screenshots (1280 × 800), taken from the real extension and the real web app, so the
// listing shows them as they ship: 1 the popup over a page it has just plucked, 2 the Inbox, 3 the reader.
//
// Needs a local server running a production build (`next dev` draws its own badge on the page) with a demo library
// (`node scripts/demo-seed.mjs <server> <email>`, which prints the key; a fresh one each time, since a page already
// in the library is not plucked again), the fixture pages (`pnpm stack`), and the extension built for a local server:
//   PLUCK_LOCAL=1 pnpm --filter @pluck/extension build
// Usage: node scripts/store-chrome.mjs <server> <email> <api key>
// Writes apps/extension/store/1-pluck-this-page.png, 2-your-inbox.png and 3-the-reader.png.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const [server, email, key] = process.argv.slice(2);
if (!server || !email || !key) throw new Error("Usage: node scripts/store-chrome.mjs <server> <email> <api key>");
const MAILPIT = "http://127.0.0.1:8035";
const PAGE = `${process.env.PLUCK_FIXTURES ?? "http://127.0.0.1:4180"}/store/field-notes.html`;
const EXTENSION = join(root, "apps/extension/.output/chrome-mv3");
const out = (name) => join(root, "apps/extension/store", name);
const size = { width: 1280, height: 800 };

const context = await chromium.launchPersistentContext("", {
  channel: "chromium", viewport: size, args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
});
const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extId = new URL(sw.url()).host;
await sw.evaluate(async ({ key, server }) => {
  await chrome.storage.local.set({ settings: { server, defaultKind: "guess", sendContent: true, transcripts: true }, apiKey: key, seenTips: true });
}, { key, server });

// Sign the browser in as the same person, through the real email link.
const page = context.pages()[0] ?? (await context.newPage());
const sent = Date.now();
await page.request.post(`${server}/api/auth/sign-in/magic-link`, { headers: { origin: server }, data: { email, callbackURL: "/inbox" } });
let link;
for (let i = 0; i < 40 && !link; i++) {
  const { messages } = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
  const fresh = messages.find((m) => new Date(m.Created).getTime() >= sent - 1000);
  if (fresh) link = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()).Text.match(/https?:\/\/\S+/)?.[0];
  else await new Promise((r) => setTimeout(r, 250));
}
if (!link) throw new Error("no sign-in email arrived");
await page.goto(link.replace("/signin/link?", "/api/auth/magic-link/verify?"));
const api = async (path, data) => (await page.request[data ? "post" : "get"](`${server}${path}`, data ? { data } : undefined)).json();
await api("/api/v1/tags", { name: "reading" });

// 1. The page, and the popup that has just plucked it, with a List and a tag tapped on.
await page.goto(PAGE);
const behind = await page.screenshot({ type: "png" });
const tabId = await sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, PAGE);
const popup = await context.newPage();
await popup.setViewportSize({ width: 360, height: 600 });
await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
await popup.getByRole("status").filter({ hasText: "Plucked" }).waitFor();
await popup.getByRole("group", { name: "Lists" }).getByRole("button").first().click();
await popup.getByRole("button", { name: "reading", exact: true }).click();
await popup.getByRole("button", { name: "reading", exact: true }).and(popup.locator("[aria-pressed=true]")).waitFor();
await popup.mouse.move(0, 599);
const card = await popup.locator(".popup").screenshot({ type: "png" });
await popup.close();
const data = (png) => `data:image/png;base64,${png.toString("base64")}`;
await page.setContent(
  `<body style="margin:0;width:1280px;height:800px;background:url(${data(behind)}) no-repeat">` +
  // Where Chrome hangs a popup: under the toolbar, at the right. Its own border and shadow, as the browser draws them.
  `<img src="${data(card)}" style="position:absolute;top:12px;right:16px;width:360px;border-radius:12px;border:1px solid #D3D9CE;box-shadow:0 12px 32px rgba(21,26,19,0.16)"></body>`,
);
writeFileSync(out("1-pluck-this-page.png"), await page.screenshot({ type: "png" }));

// 2. The Inbox, the pointer on the page just plucked so its row shows what can be done with it. Not at once: a row
// plucked in the last few seconds is drawn as just landed, and the library was seeded a moment ago.
await page.waitForTimeout(6000);
// A demo link with nothing to say for itself shows its address on its row, and here that is a local one: out of the picture.
for (const i of (await api("/api/v1/items?status=inbox&limit=50")).items)
  if (i.url && !i.excerpt) await page.request.patch(`${server}/api/v1/items/${i.id}`, { data: { status: "archived" } });
await page.goto(`${server}/inbox`);
const row = page.getByRole("listitem").first();
await row.waitFor();
await row.hover();
writeFileSync(out("2-your-inbox.png"), await page.screenshot({ type: "png" }));

// 3. The reader, on that page.
const { items } = await api("/api/v1/items?status=inbox&limit=1");
await page.goto(`${server}/items/${items[0].id}`);
await page.getByRole("article").waitFor();
await page.mouse.move(640, 700);
writeFileSync(out("3-the-reader.png"), await page.screenshot({ type: "png" }));

await context.close();
console.log("Three Chrome Web Store screenshots written to apps/extension/store.");
