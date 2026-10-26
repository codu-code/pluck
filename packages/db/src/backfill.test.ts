import { expect, test } from "vitest";
import { items, meta, oid } from "./collections.ts";
import { applyExtraction, createTextItem, nextUnsorted, pluckLink, type Unsorted } from "./index.ts";
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
  await (await meta()).deleteMany({ _id: { $in: ["backfill:previews", "backfill:posts-2026-10", "backfill:app-links-2026-10"] } });

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
  await (await meta()).deleteMany({ _id: { $in: ["backfill:previews", "backfill:posts-2026-10", "backfill:app-links-2026-10"] } });

  const seen: string[] = [];
  for (let page = await nextUnsorted(); page; page = await nextUnsorted()) seen.push(...page.map((u) => u.itemId));
  expect(seen.filter((id) => id === post.id)).toHaveLength(1);
  expect(seen).not.toContain(article.id);
  expect(await nextUnsorted()).toBeNull();
});

test("then Instagram and TikTok links once more, keeping the title a device gave them", async () => {
  const { a } = await twoUsers();
  const reel = (await pluckLink(a, { url: "https://www.instagram.com/reel/De6Q_cyzWLC/", title: "Rj Bernaldo on Instagram", source: "ios" })).item;
  await applyExtraction(a, reel.id, { ...read, title: null, kind: "video", preview: "post", facts: {} });
  const bare = (await pluckLink(a, { url: "https://www.instagram.com/p/De8SPjEAuV0/", source: "web" })).item;
  await applyExtraction(a, bare.id, { ...read, title: null, kind: "link", preview: "post", facts: {} });
  const short = (await pluckLink(a, { url: "https://vm.tiktok.com/ZMabc/", source: "web" })).item;
  await applyExtraction(a, short.id, { ...read, title: null, kind: "video", preview: "player", facts: {} });
  const post = (await pluckLink(a, { url: "https://x.com/someone/status/187", source: "web" })).item;
  await applyExtraction(a, post.id, { ...read, kind: "link", preview: "post", facts: {} });
  for (const done of ["backfill:previews", "backfill:posts-2026-10"]) await (await meta()).updateOne({ _id: done }, { $set: { done: true } }, { upsert: true });
  await (await meta()).deleteMany({ _id: "backfill:app-links-2026-10" });

  const seen: Unsorted[] = [];
  for (let page = await nextUnsorted(); page; page = await nextUnsorted()) seen.push(...page);
  expect(seen.find((u) => u.itemId === reel.id)?.title).toBe("Rj Bernaldo on Instagram");
  expect(seen.find((u) => u.itemId === bare.id)?.title).toBeNull(); // its title is its address
  expect(seen.map((u) => u.itemId)).toContain(short.id);
  expect(seen.map((u) => u.itemId)).not.toContain(post.id);
});
