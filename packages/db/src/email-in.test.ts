import { expect, test } from "vitest";
import { aliasOf, createEmailItem, getContent, regenerateAlias, searchItems, userForAlias } from "./index.ts";
import { twoUsers } from "./testing.ts";

const mail = { subject: "Writing for engineers who skim", fromName: "Field Notes", fromAddress: "hi@fieldnotes.example", messageId: "<x@y>", markdown: "Lead with the decision.", excerpt: "Lead with the decision.", wordCount: 4 };

test("one active alias per person; regenerating retires the old one", async () => {
  const { a, b } = await twoUsers();
  const t1 = await aliasOf(a);
  expect(await aliasOf(a)).toBe(t1);
  expect(await aliasOf(b)).not.toBe(t1);
  expect(await userForAlias(t1)).toBe(a);
  const t2 = await regenerateAlias(a);
  expect(t2).not.toBe(t1);
  expect(await userForAlias(t1)).toBeNull();
  expect(await userForAlias(t2.toUpperCase())).toBe(a);
});

test("an email becomes a Read item with its text kept and searchable; the same message twice is one item", async () => {
  const { a, b } = await twoUsers();
  const first = await createEmailItem(a, mail);
  expect(first.created).toBe(true);
  expect(first.item).toMatchObject({ kind: "link", url: null, source: "email", siteName: "Field Notes", title: "Writing for engineers who skim" });
  expect((await getContent(a, first.item.id))?.textMarkdown).toBe("Lead with the decision.");
  expect((await searchItems(a, { q: "decision", limit: 25 })).total).toBe(1);
  const again = await createEmailItem(a, mail);
  expect(again).toMatchObject({ created: false, item: { id: first.item.id } });
  expect((await createEmailItem(b, mail)).created).toBe(true); // same message, another person
});
