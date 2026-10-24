import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";
const rows = (page: Page) => page.getByRole("listitem");

async function seed(page: Page, files: string[]) {
  const res = await page.request.post("/api/v1/items", { data: { urls: files.map((f) => `${FIX}/${f}.html`) } });
  expect(res.ok()).toBe(true);
  // Many links are read after the response; wait until every title is in.
  await expect.poll(async () => {
    const page1 = await (await page.request.get("/api/v1/items?status=inbox")).json();
    return page1.items.filter((i: { extraction: { state: string } }) => i.extraction.state === "done").length;
  }).toBe(files.length);
}

test("keyboard triage: archive with undo, later and back", async ({ page }) => {
  await signIn(page);
  await seed(page, ["news-1", "news-2", "news-3"]);
  await page.goto("/inbox");
  await expect(page.getByText("3 to triage · newest first")).toBeVisible();
  await expect(rows(page)).toHaveCount(3);

  await page.keyboard.press("j"); // cursor on the second row
  const second = await rows(page).nth(1).getByRole("link").first().textContent();
  await page.keyboard.press("e");
  await expect(page.getByRole("status").filter({ hasText: "Gone. Well, archived." })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByRole("link", { name: second! })).toBeVisible();

  await page.keyboard.press("l");
  await expect(page.getByRole("status").filter({ hasText: "Kept for later." })).toBeVisible();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Later/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press("l"); // in Later, l goes back to the Inbox
  await expect(page.getByRole("status").filter({ hasText: "Back in the Inbox." })).toBeVisible();
  await expect(page.getByText("Nothing in Later right now.")).toBeVisible();

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Shortcuts" })).toBeVisible();
});

test("bulk select to the Archive, filters, and Restore", async ({ page }) => {
  await signIn(page);
  await seed(page, ["blog-1", "blog-2", "blog-3"]);
  await page.goto("/inbox");
  const bar = page.getByRole("toolbar", { name: "Bulk actions" });
  // The keys listen once the page has hydrated, which a slow CI runner can take a moment to do.
  await expect(async () => {
    await page.keyboard.press("x");
    await expect(bar).toContainText("1 selected", { timeout: 1000 });
  }).toPass();
  await page.keyboard.press("j");
  await page.keyboard.press("x");
  await expect(bar).toContainText("2 selected");
  await bar.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("status").filter({ hasText: "2 items. Gone. Well, archived." })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);

  await page.goto("/archive");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("archived by you");
  await page.getByRole("button", { name: "Expired" }).click();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
  await page.getByRole("button", { name: "By you" }).click();
  await expect(rows(page)).toHaveCount(2);
  await rows(page).first().getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Back in the Inbox." })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
});

test("Done is for todos, and sort puts the untouched first", async ({ page }) => {
  await signIn(page);
  await page.request.post("/api/v1/items", { data: { text: "Book the room", kind: "todo" } });
  await page.request.post("/api/v1/items", { data: { text: "A plain note" } });
  await page.goto("/inbox");
  await expect(rows(page).first()).toContainText("A plain note");
  await page.getByRole("radio", { name: "Untouched first" }).click();
  await expect(rows(page).first()).toContainText("Book the room");
  await page.keyboard.press("d");
  await expect(page.getByRole("status").filter({ hasText: "Done." })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press("d"); // a note cannot be done
  await expect(rows(page)).toHaveCount(1);
  await page.goto("/archive");
  await expect(rows(page).first()).toContainText("Todo · done");
});

test("the reader keeps highlights and the note; delete goes to the bin and back", async ({ page }) => {
  await signIn(page);
  await seed(page, ["news-4"]);
  await page.goto("/inbox");
  await page.getByRole("link", { name: "The archive is not a bin" }).click();
  await expect(page.getByRole("heading", { name: "The archive is not a bin" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Reading progress" })).toBeVisible();

  // Select a phrase in the second paragraph and highlight it.
  await page.evaluate(() => {
    const p = document.querySelectorAll("article p")[1]!;
    const text = p.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 20);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("toolbar", { name: "Selection" }).getByRole("button", { name: /Highlight/ }).click();
  await expect(page.locator("article mark")).toHaveCount(1);
  await expect(page.getByText("Highlights · 1")).toBeVisible();

  await page.getByRole("textbox", { name: "Note", exact: true }).fill("For the talk.");
  await page.getByRole("combobox", { name: "Kind" }).focus(); // blur saves the note
  await page.waitForResponse((r) => r.request().method() === "PATCH");
  await page.reload();
  await expect(page.locator("article mark")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Note", exact: true })).toHaveValue("For the talk.");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("status").filter({ hasText: "Deleted. It stays in the bin for 30 days." })).toBeVisible();
  await page.goto("/archive?view=bin");
  await expect(rows(page)).toHaveCount(1);
  await rows(page).first().getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Out of the bin." })).toBeVisible();
  await page.goto("/inbox");
  await expect(page.getByRole("link", { name: "The archive is not a bin" })).toBeVisible();
});

test("the PWA shell is served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Pluck", start_url: "/inbox", display: "standalone" });
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/offline")).ok()).toBe(true);
});
