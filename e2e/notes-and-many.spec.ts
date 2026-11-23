import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const FIX = "http://127.0.0.1:4180";
const box = (page: Page) => page.getByRole("textbox", { name: "Pluck" });
const rows = (page: Page) => page.getByRole("listitem");

test("a block of links shows the count first, then makes one row per link", async ({ page }) => {
  await signIn(page);
  await box(page).fill(`Reading for the week: ${FIX}/news-3.html, ${FIX}/docs-1.html and ${FIX}/blog-2.html.`);
  await expect(page.getByText("3 links. Enter plucks them all.")).toBeVisible();
  await box(page).press("Enter");
  await expect(rows(page)).toHaveCount(3);
  for (const title of ["Free services need honest rate limits", "Indexing the inbox query", "A kitchen plan in three drafts"])
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 15_000 });
});

test("a sentence becomes a Note you can open and keep writing", async ({ page }) => {
  await signIn(page);
  await box(page).fill("An MCP server for estimates");
  await expect(page.getByRole("radio", { name: "Note" })).toHaveAttribute("aria-checked", "true");
  await box(page).press("Enter");
  const row = rows(page).first();
  await expect(row).toContainText("Note · by you");
  await row.getByRole("link", { name: "An MCP server for estimates" }).click();

  // The words are rich text: what is typed shows as it is, with no marks.
  const body = page.getByRole("textbox", { name: "Body" });
  await expect(body).toHaveText("An MCP server for estimates");
  await body.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Estimates over MCP");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Read-only tools first.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Then one write tool behind a confirm.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Body" })).toContainText("Then one write tool");
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Estimates over MCP");

  await page.getByRole("combobox", { name: "Kind" }).selectOption("todo");
  await page.getByLabel("Due", { exact: true }).fill("2026-11-03");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(rows(page).first()).toContainText("Estimates over MCP");
  await expect(rows(page).first()).toContainText(/Todo · (due|overdue)/);
});

const textOf = async (page: Page) => {
  const id = page.url().split("/").pop()!;
  return ((await (await page.request.get(`/api/v1/items/${id}?include=text`)).json()) as { text: string; item: { title: string; excerpt: string | null } });
};

test("a Note takes a heading, a list, bold and italic, kept as Markdown and shown with no marks", async ({ page }) => {
  await signIn(page);
  await box(page).fill("Blog idea");
  await box(page).press("Enter");
  await rows(page).first().getByRole("link", { name: "Blog idea" }).click();

  const body = page.getByRole("textbox", { name: "Body" });
  const tool = (name: string) => page.getByRole("toolbar", { name: "Format" }).getByRole("button", { name });
  await body.click();
  await page.keyboard.press("ControlOrMeta+a");
  await tool("Heading").click();
  await expect(tool("Heading")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Why inboxes beat notebooks");
  await page.keyboard.press("Enter");
  await page.keyboard.type("An ");
  await tool("Bold").click();
  await page.keyboard.type("opening");
  await tool("Bold").click();
  await page.keyboard.type(" line with ");
  await page.keyboard.press("ControlOrMeta+i");
  await page.keyboard.type("stress");
  await page.keyboard.press("ControlOrMeta+i");
  await page.keyboard.type(" and snake_case.");
  await page.keyboard.press("Enter");
  await tool("Bulleted list").click();
  await page.keyboard.type("Capture in one step");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Triage like a link");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Kept as Markdown, for the iPhone and an AI tool to read; the title and the row are plain words.
  const kept = await textOf(page);
  expect(kept.text).toBe("# Why inboxes beat notebooks\nAn **opening** line with *stress* and snake\\_case.\n- Capture in one step\n- Triage like a link");
  expect(kept.item.title).toBe("Why inboxes beat notebooks");
  expect(kept.item.excerpt).toBe("An opening line with stress and snake_case. Capture in one step Triage like a link");

  await page.reload();
  const again = page.getByRole("textbox", { name: "Body" });
  await expect(again).toContainText("Why inboxes beat notebooks");
  await expect(again).not.toContainText("#");
  await expect(again).not.toContainText("**");
  await expect(again).not.toContainText("\\");
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Why inboxes beat notebooks");
  expect((await textOf(page)).text).toBe(kept.text); // opening a Note writes nothing
});

test("a Note the rich editor cannot keep exactly opens as plain text, every character as it was", async ({ page }) => {
  await signIn(page);
  const text = "From my AI\n\n> a quote\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [ ] a task";
  const made = (await (await page.request.post("/api/v1/items", { data: { text, kind: "note" } })).json()) as { results: { item: { id: string } }[] };
  await page.goto(`/items/${made.results[0]!.item.id}`);
  // The rich editor opens first and hands over once it has read the text back differently: wait for that, since
  // toHaveValue on the rich editor (not an input) fails at once instead of trying again.
  await expect(page.getByText("Plain text.")).toBeVisible();
  const body = page.getByRole("textbox", { name: "Body" });
  await expect(body).toHaveValue(text); // the plain editor: a textarea
  await expect(page.getByRole("toolbar", { name: "Format" })).toHaveCount(0);
  await body.press("End");
  expect((await textOf(page)).text).toBe(text);
});

test("pick Todo with a due date in the paste box, and filter by kind", async ({ page }) => {
  await signIn(page);
  await box(page).fill(`${FIX}/youtube-1.html`);
  await box(page).press("Enter");
  await expect(page.getByRole("link", { name: "Postgres indexes in 40 minutes" })).toBeVisible();

  await box(page).fill("Learn window functions");
  await page.getByRole("radio", { name: "Todo" }).click();
  await page.getByLabel("Due", { exact: true }).fill("2026-11-06");
  await box(page).press("Enter");
  await expect(rows(page).first()).toContainText(/Todo · (due|overdue)/);

  await page.getByRole("button", { name: "Todos" }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Links" }).click();
  await expect(page.getByRole("button", { name: "Watch" })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Postgres indexes");
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.getByText("Nothing of this kind in Inbox.")).toBeVisible();
  await page.getByRole("button", { name: "All" }).click();
  await expect(rows(page)).toHaveCount(2);
});

test("a Note plucked offline is sent once when the network is back, even with two tabs open", async ({ page, context }) => {
  await signIn(page);
  const other = await context.newPage();
  await other.goto("/inbox");
  const text = `Offline note ${Date.now()}`;
  const count = async () => {
    const { items } = (await (await page.request.get("/api/v1/items?status=inbox&limit=50")).json()) as { items: { title: string }[] };
    return items.filter((i) => i.title === text).length;
  };
  await context.setOffline(true);
  await box(page).fill(text);
  await box(page).press("Enter");
  // Back online: both tabs hear it, then both mount again; every one of those starts a flush of the same queue.
  await context.setOffline(false);
  await Promise.all([page.reload(), other.reload()]);
  await expect.poll(count).toBe(1);
  await page.waitForTimeout(1500);
  expect(await count()).toBe(1);
});
