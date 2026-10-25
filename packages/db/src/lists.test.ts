import { describe, expect, test } from "vitest";
import {
  addToList, batchUpdate, createList, createTextItem, deleteList, editItem, getItem, getList, listLists, listsForItem, markEntries, moveToBin,
  removeFromList, reorderList, restoreFromBin, searchItems, updateEntry, updateList,
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

  test("a Todo's mark and its Done stay in step, in every List, for its owner only", async () => {
    const { a, b } = await twoUsers();
    const todo = await createTextItem(a, { kind: "todo", text: "Book the venue", source: "web" });
    const read = await note(a, "Just a note");
    const talk = await createList(a, { name: "Talk", createdBy: "user", items: [{ itemId: todo.id }, { itemId: read.id }] });
    const trip = await createList(a, { name: "Trip", createdBy: "user", items: [{ itemId: todo.id }] });
    const ticks = async (listId: string) => (await getList(a, listId))!.entries.map((e) => [e.item.title, e.ticked]);

    // Marked in one List: Done, and marked in the other.
    await updateEntry(a, talk.id, todo.id, { ticked: true }, "user");
    expect((await getItem(a, todo.id))!.status).toBe("done");
    expect(await ticks(trip.id)).toEqual([["Book the venue", true]]);
    expect((await listLists(a)).find((l) => l.id === trip.id)!.tickedCount).toBe(1);
    // A note marked read stays where it is.
    await updateEntry(a, talk.id, read.id, { ticked: true }, "user");
    expect((await getItem(a, read.id))!.status).toBe("inbox");

    // Back to the Inbox elsewhere: unmarked everywhere. Done elsewhere: marked everywhere.
    await editItem(a, todo.id, { status: "inbox" });
    expect(await ticks(talk.id)).toEqual([["Book the venue", false], ["Just a note", true]]);
    expect(await ticks(trip.id)).toEqual([["Book the venue", false]]);
    await batchUpdate(a, [todo.id], { status: "done" });
    expect(await ticks(trip.id)).toEqual([["Book the venue", true]]);
    // Archiving a Done one leaves its marks.
    await editItem(a, todo.id, { status: "archived" });
    expect(await ticks(trip.id)).toEqual([["Book the venue", true]]);

    // Unmarked in bulk: a Done one goes back to the Inbox.
    await editItem(a, todo.id, { status: "done" });
    expect(await markEntries(a, talk.id, [todo.id, read.id], false)).toBe(2);
    expect((await getItem(a, todo.id))!.status).toBe("inbox");
    expect(await ticks(trip.id)).toEqual([["Book the venue", false]]);

    // A Done Todo arrives marked in a new List.
    await editItem(a, todo.id, { status: "done" });
    const later = await createList(a, { name: "Later on", createdBy: "user", items: [{ itemId: todo.id }] });
    expect(await ticks(later.id)).toEqual([["Book the venue", true]]);

    // Someone else can neither mark it nor move it, and their own same-named Todo is untouched.
    const theirs = await createTextItem(b, { kind: "todo", text: "Book the venue", source: "web" });
    const theirList = await createList(b, { name: "Talk", createdBy: "user", items: [{ itemId: theirs.id }] });
    expect(await markEntries(b, talk.id, [todo.id], false)).toBeNull();
    expect(await updateEntry(b, talk.id, todo.id, { ticked: false }, "user")).toBe(false);
    await editItem(b, todo.id, { status: "inbox" });
    await batchUpdate(b, [todo.id], { status: "inbox" });
    expect((await getItem(a, todo.id))!.status).toBe("done");
    expect(await markEntries(a, theirList.id, [theirs.id], true)).toBeNull();
    expect((await getItem(b, theirs.id))!.status).toBe("inbox");
    expect((await getList(b, theirList.id))!.entries[0]!.ticked).toBe(false);
  });
});
