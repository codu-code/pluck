import { expect, test } from "vitest";
import { items, meta, oid } from "./collections.ts";
import { applyExtraction, createTextItem, nextUnsorted, pluckLink } from "./index.ts";
import { twoUsers } from "./testing.ts";

const read = { title: "t", siteName: null, author: null, excerpt: null, canonicalUrl: null, lang: null, wordCount: 1, markdown: "kept", extractor: "defuddle" };

test("the Preview backfill walks every link read before Previews once, then stops", async () => {
  const { a, b } = await twoUsers();
  const old = (await pluckLink(a, { url: "https://example.com/before-previews", source: "web" })).item;
  await applyExtraction(a, old.id, { ...read, kind: "link", preview: "reader", facts: {} });
  await (await items()).updateOne({ _id: oid(old.id) }, { $unset: { previewGuess: "", facts: "" } }); // as it was before
  const sorted = (await pluckLink(b, { url: "https://example.com/after-previews", source: "web" })).item;
  await applyExtraction(b, sorted.id, { ...read, kind: "link", preview: "site", facts: {} });
  const note = await createTextItem(a, { kind: "note", text: "no link", source: "web" });
  await (await meta()).deleteOne({ _id: "backfill:previews" });

  const seen: string[] = [];
  for (let page = await nextUnsorted(); page; page = await nextUnsorted()) seen.push(...page.map((u) => u.itemId));
  expect(seen).toContain(old.id);
  expect(seen).not.toContain(sorted.id);
  expect(seen).not.toContain(note.id);
  expect(seen.filter((id) => id === old.id)).toHaveLength(1);
  expect(await nextUnsorted()).toBeNull(); // done stays done
});
