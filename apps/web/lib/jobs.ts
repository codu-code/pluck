import { hitRateLimit } from "@pluck/db";
import { runQueue, type Handlers } from "./job-runner";
import { ingestInbound, keepFile, keepQueued, runExport, runImport, sendDigest, sendWelcome } from "./library";

// Queued mail (Monday emails, welcomes) shares one send rate across every instance, under SES's 14 a second,
// so sign-in links (which skip the queue) always have room.
const QUEUED_MAIL_PER_SECOND = 8;
const mailSlot = async () => {
  while (!(await hitRateLimit("send:queued", QUEUED_MAIL_PER_SECOND, 1)).ok) await new Promise((r) => setTimeout(r, 250));
};

// Worker job handlers, by queue. Keeping a page has its own retry policy (library/keeping.ts).
const handlers: Handlers = {
  async extract(p) {
    await keepQueued(String(p.userId), String(p.itemId));
  },
  async file(p) {
    await keepFile(String(p.userId), String(p.itemId), String(p.key), String(p.contentType), String(p.name));
  },
  async digest(p) {
    await mailSlot();
    await sendDigest(String(p.userId));
  },
  async welcome(p) {
    await mailSlot();
    await sendWelcome(String(p.userId));
  },
  async "email-in"(p) {
    await ingestInbound(String(p.key));
  },
  async import(p) {
    await runImport(String(p.userId), String(p.importId));
  },
  async export(p) {
    await runExport(String(p.userId), String(p.exportId));
  },
};

// Used by the cron tick and the worker loop.
export const runJobs = (opts?: { budgetMs?: number; max?: number }) => runQueue(handlers, opts);
