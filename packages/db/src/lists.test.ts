import { describe, expect, test } from "vitest";
import {
  addToList, createList, createTextItem, deleteList, getList, listLists, listsForItem, moveToBin, removeFromList, reorderList,
  restoreFromBin, searchItems, updateEntry, updateList,
} from "./index.ts";
import { twoUsers } from "./testing.ts";

const note = async (u: string, text: string) => createTextItem(u, { kind: "note", text, source: "web" });

describe("lists", () => {
  test("are per person, ordered, with a note and a tick that belong to the list", async () => {
    const { a, b } = await twoUsers();
    const [one, two, three] = [await note(a, "One"), await note(a, "Two"), await note(a, "Three")];
    const list = await createList(a, { name: "Talk on MCP auth", purpose: "Twenty minutes", createdBy: "user", items: [{ itemId: one.id, note: "Open with this" }] });
    expect(list).toMatchObject({ slug: "talk-on-mcp-auth", visibility: "private", itemCount: 1 });
    expect(await addToList(a, list.id, [two.id, three.id, one.id], { by: "user" })).toBe(2); // one is already there
    expect(await addToList(b, list.id, [two.id], { by: "user" })).toBeNull();
    const theirs = await note(b, "Theirs");
    expect(await addToList(a, list.id, [theirs.id], { by: "user" })).toBe(0);

    let got = (await getList(a, list.id))!;
    expect(got.entries.map((e) => e.item.title)).toEqual(["One", "Two", "Three"]);
    expect(got.entries[0]).toMatchObject({ note: "Open with this", noteBy: "user", ticked: false });
    expect(await getList(b, list.id)).toBeNull();

    expect(await updateEntry(a, list.id, two.id, { ticked: true, note: "Demo 3" }, "user")).toBe(true);
    expect(await updateEntry(b, list.id, two.id, { ticked: false }, "user")).toBe(false);
    expect((await listLists(a))[0]).toMatchObject({ itemCount: 3, tickedCount: 1 });

    expect(await reorderList(a, list.id, [three.id, one.id])).toBe(false); // must be the whole list
    expect(await reorderList(a, list.id, [three.id, one.id, two.id])).toBe(true);
    got = (await getList(a, list.id))!;
    expect(got.entries.map((e) => e.item.title)).toEqual(["Three", "One", "Two"]);

    // A float between neighbours moves one row in one write.
    const [p0, p1] = got.entries.map((e) => e.position);
    await updateEntry(a, list.id, two.id, { position: (p0! + p1!) / 2 }, "user");
    expect((await getList(a, list.id))!.entries.map((e) => e.item.title)).toEqual(["Three", "Two", "One"]);
    expect((await listsForItem(a, two.id))[0]).toMatchObject({ place: 2, note: "Demo 3", ticked: true });
  });

  test("crowded positions renumber; names stay unique; delete keeps the items", async () => {
    const { a } = await twoUsers();
    const [x, y] = [await note(a, "X"), await note(a, "Y")];
    const l1 = await createList(a, { name: "Reading", createdBy: "user", items: [{ itemId: x.id }, { itemId: y.id }] });
    const l2 = await createList(a, { name: "Reading", createdBy: "user" });
    expect(l2.slug).toBe("reading-2");
    const first = (await getList(a, l1.id))!.entries[0]!.position;
    await updateEntry(a, l1.id, y.id, { position: first + 1e-9 }, "user");
    const positions = (await getList(a, l1.id))!.entries.map((e) => e.position);
    expect(positions[1]! - positions[0]!).toBeGreaterThan(1);

    expect((await updateList(a, l1.id, { name: "Reading list", purpose: "Weekend" }))?.slug).toBe("reading-list");
    expect(await deleteList(a, l1.id)).toBe(true);
    expect(await listsForItem(a, x.id)).toEqual([]);
  });

  test("bin hides an item from its lists and the counts; search knows list names", async () => {
    const { a } = await twoUsers();
    const [x, y] = [await note(a, "Hob"), await note(a, "Sink")];
    const list = await createList(a, { name: "Kitchen reno", createdBy: "user", items: [{ itemId: x.id }, { itemId: y.id }] });
    expect((await searchItems(a, { q: "reno", limit: 25 })).total).toBe(2);
    expect((await searchItems(a, { q: "hob", limit: 25, listId: list.id })).total).toBe(1);

    await moveToBin(a, x.id);
    expect((await getList(a, list.id))!.entries).toHaveLength(1);
    expect((await listLists(a))[0]!.itemCount).toBe(1);
    await restoreFromBin(a, x.id);
    expect((await listLists(a))[0]!.itemCount).toBe(2);

    await removeFromList(a, list.id, y.id);
    expect((await searchItems(a, { q: "reno", limit: 25 })).total).toBe(1);
  });
});
