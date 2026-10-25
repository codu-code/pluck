import { describe, expect, test } from "vitest";
import {
  applyExtraction, createList, createTag, editItem, getListMeta, getMe, killList, killUser, moveToBin, pluckLink, PUBLIC_ITEM_FIELDS,
  publicCoverKey, publicList, publicListById, recordView, setHandle, setItemTags, setBlobKeys, setVisibility, updateEntry, updateList,
  addToList, deleteList, leaveSharedList, listsSharedWith, sharedList, shareList, sharesOf, unshareList,
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

  test("everyone gets a made-up handle, free to change; a saved one waits a month", async () => {
    const { a } = await twoUsers();
    const first = (await getMe(a))!;
    expect(first.handle).toMatch(/^[a-z]+-[a-z]+-\d\d$/);
    expect(first.handleChangeableAt).toBeNull();
    const saved = await setHandle(a, `chosen${Date.now() % 100000}`); // a made-up one does not start the month
    expect(saved.ok && saved.me.handleChangeableAt).toBeTruthy();
  });

  test("public gives a made-up handle when there is none, and a published slug survives a rename", async () => {
    const { a } = await twoUsers();
    const list = await createList(a, { name: "Kitchen", createdBy: "user" });
    expect((await setVisibility(a, list.id, "public")).ok).toBe(true);
    expect((await getMe(a))?.handle).toMatch(/^[a-z]+-[a-z]+-\d\d$/);
    expect((await updateList(a, list.id, { name: "Kitchen reno" }))?.slug).toBe("kitchen");

  });
});

describe("lists shared with people (See only)", () => {
  test("only the person it is shared with sees it, in the public view's shape; the owner can take it back", async () => {
    const { a, b } = await twoUsers();
    const bEmail = (await getMe(b))!.email;
    const it = (await pluckLink(a, { url: "https://example.com/holiday", source: "web" })).item;
    const { tag } = (await createTag(a, "secret", "user"))!;
    await setItemTags(a, it.id, [tag.id], "user");
    const list = await createList(a, { name: "Holiday ideas", createdBy: "user" });
    await addToList(a, list.id, [it.id], { note: "Book early.", by: "user" });
    await updateEntry(a, list.id, it.id, { ticked: true }, "user");

    expect(await sharedList(list.id, bEmail)).toBeNull(); // not shared yet, even though it exists
    const shared = await shareList(a, list.id, bEmail.toUpperCase());
    expect(shared).toMatchObject({ ok: true, created: true, share: { email: bEmail } });
    expect((await shareList(a, list.id, bEmail)).ok && (await shareList(a, list.id, bEmail))).toMatchObject({ created: false });
    expect(await shareList(a, list.id, (await getMe(a))!.email)).toEqual({ ok: false, reason: "self" });
    expect(await shareList(b, list.id, "x@example.test")).toEqual({ ok: false, reason: "not_found" }); // only the owner shares

    const page = (await sharedList(list.id, bEmail))!;
    expect(Object.keys(page.entries[0]!).sort()).toEqual(["excerpt", "hasCover", "id", "note", "siteName", "title", "url"]); // no tags, ticks or status
    expect(page.entries[0]!.note).toBe("Book early.");
    expect(await listsSharedWith(bEmail)).toMatchObject([{ id: list.id, name: "Holiday ideas", owner: { handle: expect.any(String) } }]);
    expect(await sharedList(list.id, "someone-else@example.test")).toBeNull();
    expect(await sharesOf(b, list.id)).toBeNull();
    expect(await sharesOf(a, list.id)).toHaveLength(1);

    expect(await unshareList(b, list.id, shared.ok ? shared.share.id : "")).toBe(false); // not theirs to take back
    expect(await unshareList(a, list.id, shared.ok ? shared.share.id : "")).toBe(true);
    expect(await sharedList(list.id, bEmail)).toBeNull();
  });

  test("the person can leave it; deleting the list or a closed account ends the share", async () => {
    const { a, b } = await twoUsers();
    const bEmail = (await getMe(b))!.email;
    const list = await createList(a, { name: "Gift ideas", createdBy: "user" });
    await shareList(a, list.id, bEmail);
    expect(await leaveSharedList(list.id, bEmail)).toBe(true);
    expect(await listsSharedWith(bEmail)).toEqual([]);
    await shareList(a, list.id, bEmail);
    await killUser(a);
    expect(await sharedList(list.id, bEmail)).toBeNull();
    expect(await listsSharedWith(bEmail)).toEqual([]);
    const other = await createList(b, { name: "Mine", createdBy: "user" });
    await shareList(b, other.id, "c@example.test");
    await deleteList(b, other.id);
    expect(await listsSharedWith("c@example.test")).toEqual([]);
  });
});
