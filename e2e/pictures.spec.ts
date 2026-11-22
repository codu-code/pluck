import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const box = (page: Page) => page.getByRole("textbox", { name: "Pluck" });
const rows = (page: Page) => page.getByRole("listitem");
// A 2 by 2 PNG: a picture small enough to write here, real enough for the worker to read.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9Qz8DAwMDEAAUADhkCAT1LKY0AAAAASUVORK5CYII=";

// Files as a drag or a paste carries them, made in the page (a DataTransfer cannot cross from the test).
const carry = (page: Page, files: { name: string; type: string; base64: string }[]) =>
  page.evaluateHandle((files) => {
    const data = new DataTransfer();
    for (const f of files) data.items.add(new File([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
    return data;
  }, files);

test("a picture dropped on the page becomes an Image, kept and shown, with no wait for the worker", async ({ page }) => {
  await signIn(page);
  const data = await carry(page, [{ name: "Poster.png", type: "image/png", base64: PNG }]);
  await page.dispatchEvent("body", "dragover", { dataTransfer: data });
  await expect(box(page)).toHaveAttribute("placeholder", "Drop a picture or a PDF to pluck it");
  await page.dispatchEvent("body", "drop", { dataTransfer: data });
  await expect(box(page)).toHaveAttribute("placeholder", "Paste one link or many, or type a note");

  const row = rows(page).first();
  await expect(row).toContainText("Poster");
  await expect(row).toContainText("Your file · photo");
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Inbox 1" })).toBeVisible();
  const { items } = (await (await page.request.get("/api/v1/items?status=inbox")).json()) as { items: { id: string; kind: string; hasCover: boolean; source: string; extraction: { state: string } }[] };
  expect(items).toMatchObject([{ kind: "image", hasCover: true, source: "web", extraction: { state: "done" } }]);

  await row.getByRole("link", { name: "Poster" }).click();
  const picture = page.getByRole("img", { name: "Poster" });
  await expect(picture).toBeVisible();
  expect(await picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(2); // the bytes came back
});

test("a copied picture pastes into the box as an Image; a file Pluck does not take is said no to", async ({ page }) => {
  await signIn(page);
  const paste = async (files: Parameters<typeof carry>[1]) => {
    const data = await carry(page, files);
    await box(page).evaluate((el, data) => el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data as DataTransfer, bubbles: true, cancelable: true })), data);
  };
  await paste([{ name: "notes.txt", type: "text/plain", base64: btoa("words") }]);
  const refused = page.getByText("Pluck takes pictures and PDFs, up to 50 MB each.");
  await expect(refused).toBeVisible();
  expect(((await (await page.request.get("/api/v1/items?status=inbox")).json()) as { items: unknown[] }).items).toHaveLength(0);

  await paste([{ name: "Screenshot.png", type: "image/png", base64: PNG }]);
  await expect(page.getByRole("link", { name: "Screenshot" })).toBeVisible();
  await expect(refused).toHaveCount(0);
  await box(page).fill("pasted words stay words");
  await expect(box(page)).toHaveValue("pasted words stay words");
});
