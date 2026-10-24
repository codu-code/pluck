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

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;

// Signs in through the real magic link. `lands` is where the link should take you (default: the Inbox).
export async function signIn(page: Page, email = uniqueEmail("e2e"), lands = "/inbox"): Promise<string> {
  if (!page.url().includes("/signin")) await page.goto(lands === "/inbox" ? "/signin" : `/signin?next=${encodeURIComponent(lands)}`);
  const sent = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status").filter({ hasText: email })).toBeVisible();
  await page.goto(await linkFromEmail(email, sent));
  await expect(page).toHaveURL(new RegExp(`${lands.replace(/[/]/g, "\\/")}$`));
  return email;
}
