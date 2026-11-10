import { describe, expect, test } from "vitest";
import { items, meta } from "./collections.ts";
import {
  addToList, archiveStale, claimOnce, countExpiringSoon, createList, createTextItem, DEFAULT_SETTINGS, getItem, localNow, pluckLink,
  runDueExpiry, updateSettings,
} from "./index.ts";
import { oid } from "./collections.ts";
import { twoUsers } from "./testing.ts";

const DAY = 86_400_000;
// `from` is the run date a test passes to runDueExpiry, so the test does not depend on today's date.
const age = async (id: string, days: number, from = new Date()) => (await items()).updateOne({ _id: oid(id) }, { $set: { lastTouchedAt: new Date(from.getTime() - days * DAY) } });

describe("expiry", () => {
  test("moves untouched items to the Archive, never items in a list, and respects scope", async () => {
    const { a } = await twoUsers();
    const old = (await pluckLink(a, { url: "https://example.com/old", source: "web" })).item;
    const { item: later } = await createTextItem(a, { kind: "note", text: "kept for later", source: "web" });
    const { item: listed } = await createTextItem(a, { kind: "note", text: "in a list", source: "web" });
    const { item: fresh } = await createTextItem(a, { kind: "note", text: "fresh", source: "web" });
    const list = await createList(a, { name: "Plan", createdBy: "user" });
    await addToList(a, list.id, [listed.id], { by: "user" });
    await (await items()).updateOne({ _id: oid(later.id) }, { $set: { status: "later" } });
    for (const id of [old.id, later.id, listed.id]) await age(id, 40);

    expect(await archiveStale(a, { olderThanDays: 30, scope: "inbox", dryRun: true })).toBe(1);
    expect(await archiveStale(a, { olderThanDays: 30, scope: "inbox_later", dryRun: true })).toBe(2);
    expect(await archiveStale(a, { olderThanDays: 30, scope: "inbox_later", dryRun: false })).toBe(2);
    expect(await getItem(a, old.id)).toMatchObject({ status: "archived", archivedReason: "bulk" });
    expect((await getItem(a, later.id))?.status).toBe("archived");
    expect((await getItem(a, listed.id))?.status).toBe("inbox");
    expect((await getItem(a, fresh.id))?.status).toBe("inbox");
  });

  test("the nightly run happens once per local day after 02:00, only for people with expiry on", async () => {
    const { a, b } = await twoUsers();
    await updateSettings(a, { timezone: "Europe/Dublin", expiryDays: 14 });
    await updateSettings(b, { expiryDays: null });
    const mine = (await pluckLink(a, { url: "https://example.com/n1", source: "web" })).item;
    const theirs = (await pluckLink(b, { url: "https://example.com/n2", source: "web" })).item;
    const oneAm = new Date("2026-10-25T00:30:00Z"); // 01:30 in Dublin (IST ends that night)
    const threeAm = new Date("2026-10-25T02:30:00Z");
    await age(mine.id, 20, threeAm);
    await age(theirs.id, 400, threeAm);

    expect((await runDueExpiry(oneAm)).perUser.find((p) => p.userId === a)).toBeUndefined();
    expect((await runDueExpiry(threeAm)).perUser.find((p) => p.userId === a)?.archived).toBe(1);
    expect((await runDueExpiry(new Date("2026-10-25T05:00:00Z"))).perUser.find((p) => p.userId === a)).toBeUndefined(); // same local day
    expect(await getItem(a, mine.id)).toMatchObject({ status: "archived", archivedReason: "expired" });
    expect((await getItem(b, theirs.id))?.status).toBe("inbox");
  });

  test("someone who never opened Settings gets the default 30 days", async () => {
    const { a } = await twoUsers(); // no settings stored
    const old = (await pluckLink(a, { url: "https://example.com/n3", source: "web" })).item;
    const at = new Date("2026-10-25T03:00:00Z");
    await age(old.id, 40, at);
    expect((await runDueExpiry(at)).perUser.find((p) => p.userId === a)?.archived).toBe(1);
  });

  test("expiring-soon counts the week before, and local dates follow the timezone", async () => {
    const { a } = await twoUsers();
    const { item: it } = await createTextItem(a, { kind: "note", text: "soon", source: "web" });
    await age(it.id, 25);
    expect(await countExpiringSoon(a, { ...DEFAULT_SETTINGS }, ["inbox"])).toBe(1);
    expect(await countExpiringSoon(a, { ...DEFAULT_SETTINGS, expiryDays: null }, ["inbox"])).toBe(0);
    expect(await countExpiringSoon(a, { ...DEFAULT_SETTINGS, expiryScope: "inbox" }, ["later"])).toBe(0);
    expect(localNow(new Date("2026-10-24T23:30:00Z"), "Pacific/Auckland").date).toBe("2026-10-25");
    expect(localNow(new Date("2026-10-24T23:30:00Z"), "Not/AZone").date).toBe("2026-10-24");
  });

  test("claimOnce lets exactly one caller through", async () => {
    const key = `test:${Date.now()}`;
    const results = await Promise.all([claimOnce(key), claimOnce(key), claimOnce(key)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test("a claim made forever has no date for the expiry to find, and one made before it is kept, not claimed again", async () => {
    const key = `test:forever:${Date.now()}`;
    expect(await claimOnce(key, { forever: true })).toBe(true);
    expect(await (await meta()).findOne({ _id: key })).toEqual({ _id: key });
    expect(await claimOnce(key, { forever: true })).toBe(false);

    expect(await claimOnce(`${key}:dated`)).toBe(true); // as every claim was made before
    expect(await claimOnce(`${key}:dated`, { forever: true })).toBe(false);
    expect(await (await meta()).findOne({ _id: `${key}:dated` })).toEqual({ _id: `${key}:dated` });
  });
});
