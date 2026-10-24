import { after } from "next/server";
import { json, route } from "@/lib/api";
import { runJobs } from "@/lib/jobs";
import { exportState, requestExport } from "@/lib/library";

// POST starts an export (a job; the link is emailed). GET is the latest one, with a download link when ready.
export const POST = route({ kind: "write", scope: "full" }, async ({ caller }) => {
  const res = await requestExport(caller.userId);
  after(() => runJobs({ budgetMs: 50_000 }).then(() => undefined)); // the link usually lands within seconds
  return json(res, 202);
});
export const GET = route({ kind: "read", scope: "full" }, async ({ caller }) => json({ export: await exportState(caller.userId) }));
