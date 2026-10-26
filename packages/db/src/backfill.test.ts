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
  await (await meta()).deleteMany({ _id: { $in: ["backfill:previews", "backfill:posts-2026-10"] } });

  const seen: string[] = [];
  for (let page = await nextUnsorted(); page; page = await nextUnsorted()) seen.push(...page.map((u) => u.itemId));
  expect(seen).toContain(old.id);
  expect(seen).not.toContain(sorted.id);
  expect(seen).not.toContain(note.id);
  expect(seen.filter((id) => id === old.id)).toHaveLength(1);
  expect(await nextUnsorted()).toBeNull(); // done stays done
});

test("then posts and players are read once more, and nothing else", async () => {
  const { a } = await twoUsers();
  const post = (await pluckLink(a, { url: "https://x.com/someone/status/186", source: "web" })).item;
  await applyExtraction(a, post.id, { ...read, kind: "link", preview: "post", facts: {} });
  const article = (await pluckLink(a, { url: "https://example.com/an-article", source: "web" })).item;
  await applyExtraction(a, article.id, { ...read, kind: "link", preview: "reader", facts: {} });
  await (await meta()).deleteMany({ _id: { $in: ["backfill:previews", "backfill:posts-2026-10"] } });

  const seen: string[] = [];
  for (let page = await nextUnsorted(); page; page = await nextUnsorted()) seen.push(...page.map((u) => u.itemId));
  expect(seen.filter((id) => id === post.id)).toHaveLength(1);
  expect(seen).not.toContain(article.id);
  expect(await nextUnsorted()).toBeNull();
});
