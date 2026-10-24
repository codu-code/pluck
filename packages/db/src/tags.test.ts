import { describe, expect, test } from "vitest";
import { items } from "./collections.ts";
import {
  batchTags, countAiTagged, createTag, deleteTag, getItem, listItems, listTags, nearestTags, pluckLink, purgeAiTags, renameTag,
  resolveTags, setItemTags, slugify,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const link = async (u: string, path: string) => (await pluckLink(u, { url: `https://example.com/${path}`, source: "web" })).item;

test("slugs ignore case, spaces and punctuation", () => {
  expect(slugify("  Kitchen Reno! ")).toBe("kitchen-reno");
  expect(slugify("Ciúin")).toBe("ciúin");
  expect(slugify("!!!")).toBe("");
});

describe("tags", () => {
  test("are per person, idempotent by slug, counted, and resolvable by name", async () => {
    const { a, b } = await twoUsers();
    const pg = (await createTag(a, "Postgres", "user"))!;
    expect(pg.created).toBe(true);
    expect((await createTag(a, "postgres", "user"))!.created).toBe(false);
    expect((await createTag(b, "postgres", "user"))!.created).toBe(true);

    const it = await link(a, "t1");
    expect(await setItemTags(a, it.id, [pg.tag.id], "user")).toBe(true);
    expect(await setItemTags(b, it.id, [pg.tag.id], "user")).toBe(false);
    expect((await listTags(a))[0]).toMatchObject({ name: "Postgres", count: 1 });
    expect((await listTags(b))[0]).toMatchObject({ count: 0 });

    expect(await resolveTags(a, [pg.tag.id, "POSTGRES", "nope"])).toEqual({ ids: [pg.tag.id], unknown: ["nope"] });
    expect(await resolveTags(b, [pg.tag.id])).toEqual({ ids: [], unknown: [pg.tag.id] });
    expect((await listItems(a, { status: "inbox", sort: "newest", limit: 50, tagId: pg.tag.id })).items).toHaveLength(1);
  });

  test("nearest suggests by spelling", async () => {
    const { a } = await twoUsers();
    for (const n of ["postgres", "python", "guitar"]) await createTag(a, n, "user");
    expect((await nearestTags(a, "postgress", 1))[0]!.name).toBe("postgres");
  });

  test("rename makes it yours and refuses a clash; delete merges or removes", async () => {
    const { a } = await twoUsers();
    const ai = (await createTag(a, "pg", "mcp"))!.tag;
    const mine = (await createTag(a, "postgres", "user"))!.tag;
    expect(await renameTag(a, ai.id, "Postgres")).toBe("conflict");
    expect(await renameTag(a, ai.id, "databases")).toMatchObject({ name: "databases", createdBy: "user" });

    const it = await link(a, "m1");
    await setItemTags(a, it.id, [ai.id, mine.id], "user");
    expect(await deleteTag(a, ai.id, { reassignTo: mine.id })).toBe(true);
    expect((await getItem(a, it.id))?.tagIds).toEqual([mine.id]);
    expect(await deleteTag(a, mine.id, { removeFromItems: true })).toBe(true);
    expect((await getItem(a, it.id))?.tagIds).toEqual([]);
  });
});

describe("AI tagging", () => {
  test("is marked, cleared when the person touches the tags, and purged in bulk", async () => {
    const { a } = await twoUsers();
    const mine = (await createTag(a, "mcp", "user"))!.tag;
    const aiMade = (await createTag(a, "auth", "mcp"))!.tag;
    const one = await link(a, "a1");
    const two = await link(a, "a2");
    await setItemTags(a, one.id, [mine.id], "user");
    await setItemTags(a, one.id, [mine.id, aiMade.id], "mcp");
    expect((await getItem(a, one.id))?.aiTagIds).toEqual([aiMade.id]);
    expect(await batchTags(a, [one.id, two.id], [aiMade.id, mine.id], [], "mcp")).toBe(2); // item one already has both
    expect(await countAiTagged(a, 7)).toBe(3);
    expect((await listTags(a)).find((t) => t.name === "auth")?.aiCount).toBe(2);

    // The person touches item two's tags: those become theirs.
    await setItemTags(a, two.id, [aiMade.id, mine.id], "user");
    expect((await getItem(a, two.id))?.aiTagIds).toEqual([]);

    const res = await purgeAiTags(a, 7);
    expect(res.assignments).toBe(1);
    expect((await getItem(a, one.id))?.tagIds).toEqual([mine.id]);
    expect((await getItem(a, two.id))?.tagIds.sort()).toEqual([aiMade.id, mine.id].sort());
    expect(res.tags).toBe(0); // "auth" is still on item two, so it stays
  });

  test("old AI tags are outside the window, and an emptied AI tag is deleted", async () => {
    const { a } = await twoUsers();
    const aiMade = (await createTag(a, "fresh", "mcp"))!.tag;
    const old = (await createTag(a, "old", "mcp"))!.tag;
    const it = await link(a, "w1");
    await setItemTags(a, it.id, [aiMade.id, old.id], "mcp");
    await (await items()).updateOne({ url: it.url }, { $set: { "aiTags.1.at": new Date(Date.now() - 30 * 86_400_000) } });
    expect(await purgeAiTags(a, 7)).toEqual({ assignments: 1, tags: 1 });
    expect((await getItem(a, it.id))?.tagIds).toEqual([old.id]);
    expect((await listTags(a)).map((t) => t.name)).toEqual(["old"]);
  });
});
