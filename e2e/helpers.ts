import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:8035";

// Polls Mailpit for the newest message to `to` sent after `after` and returns the first link in it.
// (A reused address, like the admin's, has older links in Mailpit.)
export async function linkFromEmail(to: string, after = 0): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= after - 1000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text: string };
      const url = msg.Text.match(/https?:\/\/\S+/)?.[0];
      if (url) return url;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email to ${to}`);
}

// Opens a sign-in email's link the way a person does, after a mail scanner has fetched it first: the fetch must
// not spend it (lib/signin-link.ts), and the tap must.
export async function openSignInLink(page: Page, link: string): Promise<void> {
  expect((await page.request.get(link, { maxRedirects: 0 })).status()).toBe(200);
  await page.goto(link);
  await page.getByRole("button", { name: "Sign in to Pluck" }).click();
}

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;

// Signs in through the real magic link. `lands` is where the link should take you (default: the Inbox).
export async function signIn(page: Page, email = uniqueEmail("e2e"), lands = "/inbox"): Promise<string> {
  if (!page.url().includes("/signin")) await page.goto(lands === "/inbox" ? "/signin" : `/signin?next=${encodeURIComponent(lands)}`);
  const sent = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status").filter({ hasText: email })).toBeVisible();
  await openSignInLink(page, await linkFromEmail(email, sent));
  await expect(page).toHaveURL(new RegExp(`${lands.replace(/[/]/g, "\\/")}$`));
  return email;
}

// Saves the page as standalone HTML (CSS inlined, scripts removed) to test-results/design, so `pnpm design`
// can run the impeccable detector on screens it cannot reach itself (signed-in pages, the extension).
// The web fonts go too, at their own paths beside the pages: without them every machine measures its own fallback
// fonts, and a Linux runner's are wide enough to fail checks a Mac passes.
export async function snapshot(page: Page, name: string): Promise<void> {
  const { html, fonts } = await page.evaluate(async () => {
    const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]);
    // Font URLs are relative to their stylesheet, not the page: fetch each from there and point the copy at /fonts/.
    const found = new Map<string, string>(); // absolute URL → file name
    const css = rules.map((r) => {
      if (!(r instanceof CSSFontFaceRule)) return r.cssText;
      const base = r.parentStyleSheet?.href ?? location.href;
      return r.cssText.replace(/url\("?([^")]+)"?\)/g, (_, u: string) => {
        const at = new URL(u, base).href;
        const name = new URL(at).pathname.split("/").pop()!;
        found.set(at, name);
        return `url("/fonts/${name}")`;
      });
    }).join("\n");
    const fonts = await Promise.all([...found].map(async ([at, name]) => {
      const bytes = new Uint8Array(await (await fetch(at)).arrayBuffer());
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return { path: `/fonts/${name}`, data: btoa(bin) };
    }));
    const doc = document.documentElement.cloneNode(true) as HTMLElement;
    doc.querySelectorAll("script, link[rel=stylesheet], link[rel=preload]").forEach((n) => n.remove());
    doc.querySelector("head")!.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
    return { html: `<!doctype html>${doc.outerHTML}`, fonts };
  });
  for (const f of fonts) {
    const at = join("test-results/design", f.path);
    if (existsSync(at)) continue;
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, Buffer.from(f.data, "base64"));
  }
  mkdirSync("test-results/design", { recursive: true });
  writeFileSync(`test-results/design/${name}.html`, html);
}
