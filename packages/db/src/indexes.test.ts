import { ObjectId } from "mongodb";
import { expect, test } from "vitest";
import { contents, highlights, items } from "./collections.ts";

// The winning plan's stage names, flattened (FETCH > IXSCAN, SORT > …).
const stages = (plan: Record<string, unknown>): string[] =>
  [String(plan.stage), ...[plan.inputStage, ...((plan.inputStages as unknown[]) ?? [])].filter(Boolean).flatMap((p) => stages(p as Record<string, unknown>))];
const planOf = async (explain: Promise<unknown>) => (await explain as { queryPlanner: { winningPlan: Record<string, unknown> } }).queryPlanner.winningPlan;

test("a page of a listing comes off an index, with no sort in memory", async () => {
  const col = await items();
  const userId = new ObjectId();
  for (const [status, field] of [["inbox", "createdAt"], ["archived", "statusChangedAt"]] as const) {
    const plan = await planOf(col.find({ userId, status, deletedAt: null }).sort({ [field]: -1, _id: -1 }).limit(51).explain());
    expect(stages(plan), status).not.toContain("SORT");
  }
  const bin = await planOf(col.find({ userId, deletedAt: { $gt: new Date(0) } }).sort({ deletedAt: -1, _id: -1 }).limit(51).explain());
  expect(stages(bin)).not.toContain("SORT");
});

test("search reads one person's part of the text index", async () => {
  const col = await items();
  const plan = await planOf(col.find({ userId: new ObjectId(), deletedAt: null, $text: { $search: "javascript" } }).explain());
  expect(JSON.stringify(plan)).toContain('"indexName":"search_by_user"');
  expect(JSON.stringify(plan)).toContain('"userId"');
});

// How many documents a query read to answer, from explain("executionStats"); an aggregate nests it under its cursor.
type Stats = { executionStats: { totalDocsExamined: number } };
const docsRead = (e: unknown) => ((e as Stats).executionStats ?? (e as { stages: { $cursor: Stats }[] }).stages[0]!.$cursor.executionStats).totalDocsExamined;

test("the count beside a Status reads no documents, and the by-AI counts read only the Items an AI tagged", async () => {
  const col = await items();
  const userId = new ObjectId();
  const at = new Date();
  // why: raw rows are enough here; only the indexed fields matter. 40 in the Inbox, 4 of them binned, 5 tagged by AI.
  const rows = Array.from({ length: 40 }, (_, i) => ({ _id: new ObjectId(), userId, status: "inbox", deletedAt: i % 10 === 9 ? at : null, ...(i % 8 ? {} : { aiTags: [{ tagId: new ObjectId(), at }] }) }));
  await col.insertMany(rows as never[]);
  // The shapes countItems (countDocuments), listTags, countAiTagged and purgeAiTags send.
  const count = [{ $match: { userId, status: "inbox", deletedAt: null } }, { $group: { _id: 1, n: { $sum: 1 } } }];
  expect((await col.aggregate(count).toArray())[0]).toMatchObject({ n: 36 });
  expect(docsRead(await col.aggregate(count).explain("executionStats"))).toBe(0);
  expect(docsRead(await col.aggregate([{ $match: { userId, deletedAt: null, "aiTags.at": { $type: "date" } } }, { $unwind: "$aiTags" }]).explain("executionStats"))).toBe(5);
  expect(docsRead(await col.aggregate([{ $match: { userId, "aiTags.at": { $gte: new Date(at.getTime() - 1000) } } }, { $unwind: "$aiTags" }]).explain("executionStats"))).toBe(5);
  expect(docsRead(await col.find({ userId, aiTags: { $elemMatch: { at: { $gte: new Date(at.getTime() - 1000) } } } }).explain("executionStats"))).toBe(5);
});

test("one person's kept text, and a purged Item's highlights, are found by an index", async () => {
  const kept = await planOf((await contents()).find({ userId: new ObjectId() }).explain());
  expect(stages(kept)).toEqual(["FETCH", "IXSCAN"]);
  const purge = await planOf((await highlights()).find({ itemId: { $in: [new ObjectId(), new ObjectId()] } }).explain());
  expect(stages(purge)).toEqual(["FETCH", "IXSCAN"]);
});
