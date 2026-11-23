import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// What a new account opens on: nothing empty, and somewhere for the first pluck to go.
test("a new account starts with a post in the Inbox, two Lists, and one of them with something in it", async ({ page }) => {
  await signIn(page, undefined, "/inbox", { starters: true });
  const rows = page.getByRole("list", { name: /inbox/i }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Nothing is deleted.");
  await expect(page.getByRole("heading", { name: "Nothing plucked yet." })).toHaveCount(0);

  // The post opens in the reader, kept from our own words.
  await rows.first().getByRole("link", { name: /Nothing is deleted/ }).first().click();
  await expect(page.getByRole("article")).toContainText("Archive");

  await page.goto("/lists");
  await expect(page.getByRole("row").filter({ hasText: "Ideas" })).toContainText("0 of 1");
  await expect(page.getByRole("row").filter({ hasText: "Favourites" })).toContainText("0 of 0");
  await page.getByRole("link", { name: "Ideas" }).click();
  await expect(page.getByRole("list", { name: "Ideas, in order" }).getByRole("listitem")).toContainText(["Ask your AI what you plucked."]);

  // Triaged to nothing, the Inbox is a cleared Inbox, not a library nobody has plucked into.
  await page.goto("/inbox");
  await rows.first().hover();
  await page.keyboard.press("e");
  await expect(rows).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing plucked yet." })).toHaveCount(0);
});

test("a #tag typed in a Note or in a link's note tags the Item", async ({ page }) => {
  await signIn(page);
  const made = (await (await page.request.post("/api/v1/items", { data: { text: "Sourdough, fed daily #baking", kind: "note" } })).json()) as { results: { item: { id: string; tagIds: string[] } }[] };
  expect(made.results[0]!.item.tagIds).toHaveLength(1);
  await page.goto("/inbox");
  await expect(page.getByRole("listitem").first()).toContainText("baking"); // the chip on its row

  // Typed in the editor: the chip shows beside the Note as soon as the words are saved.
  await page.goto(`/items/${made.results[0]!.item.id}`);
  const tags = page.getByRole("complementary").getByText("recipes", { exact: true });
  await expect(tags).toHaveCount(0);
  const body = page.getByRole("textbox", { name: "Body" });
  await body.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" #recipes for the weekend");
  await expect(tags).toBeVisible();
  const names = async () => ((await (await page.request.get("/api/v1/tags")).json()).tags as { name: string }[]).map((t) => t.name).sort();
  expect(await names()).toEqual(["baking", "recipes"]); // no half-typed "rec" left behind
});
