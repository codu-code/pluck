import { createHash, timingSafeEqual } from "node:crypto";
import { runJobs } from "@/lib/jobs";
import { runScheduled } from "@/lib/schedule";

const digest = (s: string) => createHash("sha256").update(s).digest(); // equal lengths for timingSafeEqual

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron calls this every minute with `Authorization: Bearer $CRON_SECRET`. Self-host runs worker.ts instead.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) return new Response("unauthorized", { status: 401 });
  const scheduled = await runScheduled();
  return Response.json({ ...scheduled, ...(await runJobs({ budgetMs: 45_000 })) });
}
