import { describe, expect, test } from "vitest";
import {
  applyExtraction, createList, createTag, editItem, getListMeta, killList, killUser, moveToBin, pluckLink, PUBLIC_ITEM_FIELDS,
  publicCoverKey, publicList, publicListById, recordView, setHandle, setItemTags, setBlobKeys, setVisibility, updateEntry, updateList,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const SECRET = "the-kept-page-text-must-never-be-public";

let n = 0;
async function publishedList() {
  const { a, b } = await twoUsers();
  const handle = `niall${++n}${Date.now() % 1000}`;
  expect((await setHandle(a, handle)).ok).toBe(true);
  const it = (await pluckLink(a, { url: "https://example.com/mcp", source: "web" })).item;
  await applyExtraction(a, it.id, {
    kind: "link", title: "How MCP auth works", siteName: "MCP", author: null, excerpt: "Tokens and scopes", canonicalUrl: null, lang: "en",
    wordCount: 900, markdown: SECRET, extractor: "defuddle",
  });
  await setBlobKeys(a, it.id, { coverKey: "u/x/cover" });
  const tag = (await createTag(a, "private-tag-name", "user"))!.tag;
  await setItemTags(a, it.id, [tag.id], "user");
  await editItem(a, it.id, { status: "archived", note: "a private item note" });
  const list = await createList(a, { name: "Best MCP reading", purpose: "Start here.", createdBy: "user", items: [{ itemId: it.id, note: "Read first." }] });
  await updateEntry(a, list.id, it.id, { ticked: true }, "user");
  expect((await setVisibility(a, list.id, "public")).ok).toBe(true);
  return { a, b, it, list, handle };
}

describe("the public projection", () => {
  test("serves exactly the pinned fields and nothing else", async () => {
    expect(PUBLIC_ITEM_FIELDS).toEqual({ title: 1, siteName: 1, excerpt: 1, coverKey: 1, url: 1 });
    const { it, handle } = await publishedList();
    const page = (await publicList(handle, "best-mcp-reading"))!;
    expect(Object.keys(page).sort()).toEqual(["author", "entries", "list"]);
    expect(Object.keys(page.list).sort()).toEqual(["id", "itemCount", "name", "noindex", "purpose", "updatedAt"]);
    expect(Object.keys(page.author).sort()).toEqual(["handle", "name"]);
    expect(page.entries).toEqual([
      { id: it.id, title: "How MCP auth works", siteName: "MCP", excerpt: "Tokens and scopes", url: "https://example.com/mcp", hasCover: true, note: "Read first." },
    ]);
    const all = JSON.stringify(page);
    for (const leak of [SECRET, "private-tag-name", "a private item note", "ticked", "archived", "u/x/cover"]) expect(all).not.toContain(leak);
    expect(page.list.noindex).toBe(true); // a new list
  });

  test("private, killed, closed accounts and binned items are not served", async () => {
    const { a, it, list, handle } = await publishedList();
    expect(await publicListById(list.id)).not.toBeNull();
    await moveToBin(a, it.id);
    expect((await publicList(handle, "best-mcp-reading"))!.entries).toEqual([]);
    await setVisibility(a, list.id, "private");
    expect(await publicList(handle, "best-mcp-reading")).toBeNull();
    await setVisibility(a, list.id, "public");
    await killList(list.id);
    expect(await publicList(handle, "best-mcp-reading")).toBeNull();
    expect((await setVisibility(a, list.id, "public")).ok).toBe(false);
  });

  test("an account an admin closed cannot publish", async () => {
    const { a, list, handle } = await publishedList();
    await killUser(a);
    expect(await publicList(handle, "best-mcp-reading")).toBeNull();
    expect(await setVisibility(a, list.id, "public")).toEqual({ ok: false, reason: "closed" });
  });

  test("covers are served only for items on a live public list; views count", async () => {
    const { a, it, list } = await publishedList();
    expect(await publicCoverKey(list.id, it.id)).toBe("u/x/cover");
    const other = (await pluckLink(a, { url: "https://example.com/not-listed", source: "web" })).item;
    await setBlobKeys(a, other.id, { coverKey: "u/x/other" });
    expect(await publicCoverKey(list.id, other.id)).toBeNull();
    await recordView(list.id);
    expect((await getListMeta(a, list.id))?.views).toBe(1);
    await setVisibility(a, list.id, "private");
    expect(await publicCoverKey(list.id, it.id)).toBeNull();
  });
});

describe("handles and publishing", () => {
  test("handles are validated, unique and change once a month", async () => {
    const { a, b } = await twoUsers();
    expect(await setHandle(a, "x")).toEqual({ ok: false, reason: "invalid" });
    expect(await setHandle(a, "Has Space")).toEqual({ ok: false, reason: "invalid" });
    expect(await setHandle(a, "settings")).toEqual({ ok: false, reason: "reserved" });
    expect((await setHandle(a, "@Unique-One")).ok).toBe(true);
    expect(await setHandle(b, "unique-one")).toEqual({ ok: false, reason: "taken" });
    expect(await setHandle(a, "unique-two")).toEqual({ ok: false, reason: "too_soon" });
    expect((await setHandle(a, "unique-two", new Date(Date.now() + 31 * 86_400_000))).ok).toBe(true);
  });

  test("public needs a handle, and a published slug survives a rename", async () => {
    const { a } = await twoUsers();
    const list = await createList(a, { name: "Kitchen", createdBy: "user" });
    expect(await setVisibility(a, list.id, "public")).toEqual({ ok: false, reason: "handle_required" });
    await setHandle(a, `maker${Date.now() % 100000}`);
    await setVisibility(a, list.id, "public");
    expect((await updateList(a, list.id, { name: "Kitchen reno" }))?.slug).toBe("kitchen");

  });
});
