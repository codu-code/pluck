import { createHash, timingSafeEqual } from "node:crypto";
import { runJobs } from "@/lib/jobs";
import { log } from "@/lib/log";
import { runScheduled } from "@/lib/schedule";

const digest = (s: string) => createHash("sha256").update(s).digest(); // equal lengths for timingSafeEqual

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron calls this every minute with `Authorization: Bearer $CRON_SECRET`. Self-host runs worker.ts instead.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) return new Response("unauthorized", { status: 401 });
  const started = Date.now();
  // A failure in the schedule (an S3 hiccup polling email-in) must not stop this minute's jobs.
  const scheduled = await runScheduled().catch((e) => (log("error", "scheduled run failed", { error: e }), {}));
  // Jobs start in what is left of the first 35 s: the four running when it ends get up to 20 s each to read a slow
  // page (keeping.ts), and all of it has to be done inside the 60.
  return Response.json({ ...scheduled, ...(await runJobs({ budgetMs: Math.max(0, 35_000 - (Date.now() - started)) })) });
}
