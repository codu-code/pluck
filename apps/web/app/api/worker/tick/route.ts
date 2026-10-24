import { runJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron calls this every minute with `Authorization: Bearer $CRON_SECRET`. Self-host runs worker.ts instead.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await runJobs({ budgetMs: 45_000 }));
}
