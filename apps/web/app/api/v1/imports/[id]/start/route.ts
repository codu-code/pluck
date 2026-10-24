import { after } from "next/server";
import { json, route } from "@/lib/api";
import { runJobs } from "@/lib/jobs";
import { startImport } from "@/lib/library";

// Starts the import job and runs the queue straight after the response, so a small file is done in
// seconds instead of waiting for the next cron tick.
export const POST = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  const res = await startImport(caller.userId, params.id);
  after(() => runJobs({ budgetMs: 50_000 }).then(() => undefined));
  return json({ import: res });
});
