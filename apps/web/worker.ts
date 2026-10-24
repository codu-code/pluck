// The worker entry: the same code as the web app, looping over the job queue. `pnpm worker` locally,
// the `worker` service in Docker Compose for self-host. Hosted on Vercel, the cron tick does this instead.
import { fileURLToPath } from "node:url";
import { runJobs } from "./lib/jobs";
import { log } from "./lib/log";
import { runScheduled } from "./lib/schedule";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {}

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));

log("info", "worker started");
let lastScheduled = 0;
while (!stopping) {
  if (Date.now() - lastScheduled > 60_000) {
    lastScheduled = Date.now();
    await runScheduled().catch((e) => log("error", "scheduled run failed", { error: e }));
  }
  const { ran } = await runJobs({ budgetMs: 30_000 }).catch((e) => {
    log("error", "worker loop error", { error: e });
    return { ran: 0 };
  });
  if (!ran) await new Promise((r) => setTimeout(r, 2000));
}
process.exit(0);
