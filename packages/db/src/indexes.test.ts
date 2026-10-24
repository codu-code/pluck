import { ObjectId } from "mongodb";
import { expect, test } from "vitest";
import { items } from "./collections.ts";

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
