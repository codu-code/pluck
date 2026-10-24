import { expect, test } from "vitest";
import { items, lists, oid } from "./collections.ts";
import { addToList, claimDueDigests, createList, createTextItem, DEFAULT_SETTINGS, digestFor, editItem, isEmptyDigest, updateSettings } from "./index.ts";
import { twoUsers } from "./testing.ts";

const DAY = 86_400_000;
const touch = async (id: string, daysAgo: number) => (await items()).updateOne({ _id: oid(id) }, { $set: { lastTouchedAt: new Date(Date.now() - daysAgo * DAY), createdAt: new Date(Date.now() - daysAgo * DAY) } });

test("the digest: expiring within a week (not in a list), due this week, oldest inbox, quiet lists", async () => {
  const { a, b } = await twoUsers();
  const expiring = await createTextItem(a, { kind: "note", text: "Expiring", source: "web" });
  const listed = await createTextItem(a, { kind: "note", text: "Listed", source: "web" });
  const tooOld = await createTextItem(a, { kind: "note", text: "Already past", source: "web" });
  await touch(expiring.id, 25);
  await touch(listed.id, 25);
  await touch(tooOld.id, 31);
  const due = await createTextItem(a, { kind: "todo", text: "Due Friday", source: "web", dueAt: new Date(Date.now() + 3 * DAY) });
  await createTextItem(a, { kind: "todo", text: "Due next month", source: "web", dueAt: new Date(Date.now() + 30 * DAY) });
  const doneTodo = await createTextItem(a, { kind: "todo", text: "Done already", source: "web", dueAt: new Date(Date.now() + DAY) });
  await editItem(a, doneTodo.id, { status: "done" });
  const list = await createList(a, { name: "Chapter 3", createdBy: "user" });
  await addToList(a, list.id, [listed.id], { by: "user" });
  await (await lists()).updateOne({ _id: oid(list.id) }, { $set: { lastActivityAt: new Date(Date.now() - 31 * DAY) } });
  await createTextItem(b, { kind: "note", text: "Theirs", source: "web" });

  const d = await digestFor(a, DEFAULT_SETTINGS);
  expect(d.expiring.map((e) => e.title)).toEqual(["Expiring"]);
  expect(d.due.map((x) => x.id)).toEqual([due.id]);
  expect(d.oldest[0]!.title).toBe("Already past");
  expect(d.oldest.map((o) => o.title)).not.toContain("Theirs");
  expect(d.quietLists).toEqual([{ id: list.id, name: "Chapter 3", tickedCount: 0, itemCount: 1, idleDays: 31 }]);
  expect((await digestFor(a, { ...DEFAULT_SETTINGS, expiryDays: null })).expiring).toEqual([]);
  expect(isEmptyDigest(await digestFor((await twoUsers()).a, DEFAULT_SETTINGS))).toBe(true);
});

test("digests go out on the person's day, at or after 06:00 local, once", async () => {
  const { a, b } = await twoUsers();
  await updateSettings(a, { timezone: "America/New_York", digestDay: 1 });
  await updateSettings(b, { digestDay: null });
  const mon5 = new Date("2026-10-26T09:30:00Z"); // 05:30 Monday in New York
  const mon7 = new Date("2026-10-26T11:00:00Z"); // 07:00
  expect((await claimDueDigests(mon5)).map((u) => u.userId)).not.toContain(a);
  expect((await claimDueDigests(mon7)).map((u) => u.userId)).toContain(a);
  expect((await claimDueDigests(new Date("2026-10-26T15:00:00Z"))).map((u) => u.userId)).not.toContain(a);
  expect((await claimDueDigests(new Date("2026-10-27T11:00:00Z"))).map((u) => u.userId)).not.toContain(a); // Tuesday
  expect((await claimDueDigests(mon7)).map((u) => u.userId)).not.toContain(b);
});

test("someone who never opened Settings gets the Monday email", async () => {
  const { a } = await twoUsers(); // no settings stored: the defaults, Monday in UTC
  expect((await claimDueDigests(new Date("2026-10-26T06:30:00Z"))).map((u) => u.userId)).toContain(a);
});
