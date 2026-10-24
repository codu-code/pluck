import { expect, test, type Page } from "@playwright/test";
import { ageItemsOf, ageListsOf } from "./db";
import { signIn } from "./helpers";

const MAILPIT = "http://127.0.0.1:8035";

async function latestDigest(to: string, after: number): Promise<{ text: string; html: string; subject: string }> {
  for (let i = 0; i < 40; i++) {
    const { messages } = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}" subject:plucked`)}`)).json()) as {
      messages: { ID: string; Created: string; Subject: string }[];
    };
    const m = messages.find((x) => new Date(x.Created).getTime() >= after - 1000);
    if (m) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { Text: string; HTML: string };
      return { text: full.Text, html: full.HTML, subject: m.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no digest");
}

const link = (text: string, label: string) => text.match(new RegExp(`${label}: (\\S+)`))![1]!;

async function tap(page: Page, url: string) {
  await page.goto(url.replace(/^https?:\/\/[^/]+/, ""));
}

test("the weekly email: sections, one-tap Keep and Let it go with undo, Archive it all, and Stop", async ({ page }) => {
  const email = await signIn(page);
  for (const text of ["Design reviews field guide", "Restaurant list notes", "Meetup that people return to"]) await page.request.post("/api/v1/items", { data: { text } });
  await page.request.post("/api/v1/items", { data: { text: "Learn window functions", kind: "todo", dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString() } });
  const ids = (await (await page.request.get("/api/v1/items?status=inbox")).json()).items as { id: string; title: string }[];
  const list = (await (await page.request.post("/api/v1/lists", { data: { name: "Book, chapter 3 sources" } })).json()).list;
  await page.request.post(`/api/v1/lists/${list.id}/items`, { data: { itemId: ids.find((i) => i.title === "Learn window functions")!.id } });
  await ageItemsOf(email, ["Design reviews field guide", "Restaurant list notes"], 25);
  await ageItemsOf(email, ["Meetup that people return to"], 40);
  await ageListsOf(email, 31);

  await page.goto("/settings");
  const sent = Date.now();
  await page.getByRole("button", { name: "Send me one now" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent. Check your email." })).toBeVisible();
  const mail = await latestDigest(email, sent);
  expect(mail.subject).toBe("Two things you plucked and forgot.");
  for (const part of ["UNTOUCHED FOR 30 DAYS", "Design reviews field guide", "DUE THIS WEEK", "Learn window functions", "OLDEST IN YOUR INBOX", "LISTS GONE QUIET", "Book, chapter 3 sources, 0 of 1 ticked, 31 days", "never deleted"])
    expect(mail.text).toContain(part);

  // Keep: one tap, no login needed (a fresh browser would work the same).
  const keeps = [...mail.text.matchAll(/Keep: (\S+)/g)].map((m) => m[1]!);
  await tap(page, keeps[0]!);
  await expect(page.getByRole("status")).toHaveText("Kept. It stays where it is, and the days start again.");

  // Let it go, then Undo.
  await tap(page, [...mail.text.matchAll(/Let it go: (\S+)/g)][1]![1]!);
  await expect(page.getByRole("status")).toHaveText("Moved to the Archive. Nothing is deleted.");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toHaveText("Back where it was.");

  // Archive it all: a count, then a real yes.
  await tap(page, mail.text.match(/in one go: (\S+)/)![1]!);
  await expect(page.getByText(/^1 item untouched for longer than your expiry length/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, move 1 to the Archive" }).click();
  await expect(page.getByRole("status")).toHaveText("1 item moved to the Archive. Nothing is deleted.");

  // Stop these.
  await tap(page, link(mail.text, "Stop these"));
  await expect(page.getByRole("status")).toHaveText("No more weekly emails. Turn them back on in Settings whenever you like.");
  await page.goto("/settings");
  await expect(page.getByRole("combobox", { name: "Weekly email" })).toHaveValue("off");

  // A forged link does nothing.
  await page.goto("/d/forged.link");
  await expect(page.getByRole("heading", { name: "This link has expired." })).toBeVisible();
});
