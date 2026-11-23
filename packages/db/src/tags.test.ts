import { describe, expect, test } from "vitest";
import { items } from "./collections.ts";
import {
  batchTags, countAiTagged, createTag, deleteTag, moveToBin, tagByWords, getItem, listItems, listTags, nearestTags, pluckLink, purgeAiTags, renameTag,
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
    const { a, b } = await twoUsers();
    const aiMade = (await createTag(a, "fresh", "mcp"))!.tag;
    const old = (await createTag(a, "old", "mcp"))!.tag;
    const it = await link(a, "w1");
    await setItemTags(a, it.id, [aiMade.id, old.id], "mcp");
    await (await items()).updateOne({ url: it.url }, { $set: { "aiTags.1.at": new Date(Date.now() - 30 * 86_400_000) } });
    expect(await purgeAiTags(b, 7)).toEqual({ assignments: 0, tags: 0 }); // nothing of theirs to undo, and A's stay
    expect(await purgeAiTags(a, 7)).toEqual({ assignments: 1, tags: 1 });
    expect((await getItem(a, it.id))?.tagIds).toEqual([old.id]);
    expect((await listTags(a)).map((t) => t.name)).toEqual(["old"]);
  });
});

test("words tag an Item: a new #tag goes on, a slip comes off again, and nothing put on by hand is ever touched", async () => {
  const { a, b } = await twoUsers();
  const it = await link(a, "words");
  const names = async () => {
    const all = await listTags(a);
    return (await getItem(a, it.id))!.tagIds.map((id) => all.find((t) => t.id === id)?.name).sort();
  };
  const t0 = new Date();
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

  expect(await tagByWords(b, it.id, ["theirs"], [])).toBe(false); // not b's Item: nothing made, nothing tagged
  expect(await listTags(b)).toEqual([]);

  // Kept as it is typed: "#rec", then "#recipes". The first comes off and, made by the slip and on nothing, is gone.
  expect(await tagByWords(a, it.id, ["rec"], [], t0)).toBe(true);
  expect(await tagByWords(a, it.id, ["recipes"], ["rec"], at(1))).toBe(true);
  expect(await names()).toEqual(["recipes"]);
  expect((await listTags(a)).map((t) => t.name)).toEqual(["recipes"]);

  // A tag put on by hand is the person's: the same word typed, then typed further, takes nothing off and drops nothing.
  const work = (await createTag(a, "work", "user"))!.tag;
  await batchTags(a, [it.id], [work.id], [], "user");
  await tagByWords(a, it.id, ["recipes", "work"], ["recipes"], at(2));
  await tagByWords(a, it.id, ["recipes", "workout"], ["recipes", "work"], at(3));
  expect(await names()).toEqual(["recipes", "work", "workout"]);

  // The word taken out while it is still being written takes its tag with it; taken out later, the tag stays.
  await tagByWords(a, it.id, ["recipes"], ["recipes", "workout"], at(4));
  expect(await names()).toEqual(["recipes", "work"]);
  expect(await tagByWords(a, it.id, [], ["recipes"], at(20))).toBe(false);
  expect(await names()).toEqual(["recipes", "work"]);

  // Taken off by hand, it is not put back while its word stays; and setting tags by hand makes them all the person's.
  await setItemTags(a, it.id, [work.id], "user");
  expect(await tagByWords(a, it.id, ["recipes"], ["recipes"], at(21))).toBe(false);
  await tagByWords(a, it.id, ["recipes", "soon"], ["recipes"], at(22));
  await setItemTags(a, it.id, (await getItem(a, it.id))!.tagIds, "user");
  await tagByWords(a, it.id, ["recipes"], ["recipes", "soon"], at(23));
  expect(await names()).toEqual(["soon", "work"]);

  // A slip's tag another Item has, even one in the Bin, is not dropped. And an Item never goes past 50 tags.
  const other = await link(a, "words-2");
  await tagByWords(a, other.id, ["ba"], [], at(24));
  await tagByWords(a, it.id, ["ba"], [], at(24));
  await moveToBin(a, other.id);
  await tagByWords(a, it.id, ["baking"], ["ba"], at(25));
  expect((await listTags(a)).map((t) => t.name)).toContain("ba");
  const many = await Promise.all(Array.from({ length: 48 }, (_, i) => createTag(a, `filler ${i}`, "user")));
  await setItemTags(a, it.id, many.map((m) => m!.tag.id), "user");
  await tagByWords(a, it.id, ["one", "two", "three"], [], at(26));
  expect((await getItem(a, it.id))!.tagIds).toHaveLength(50);
});
