// The public interface of packages/db. Raw client and Db handles stay internal so every caller goes through userId-scoped functions.
export { ping } from "./client.ts";
export { authAdapter } from "./auth.ts";
export {
  pluckLink, applyExtraction, recordExtractionFailure, resetExtraction, setBlobKeys,
  getItem, getItemBlobKeys, getContent, listItems, urlHash,
  type PluckLinkInput, type ExtractionResult,
} from "./items.ts";
export { enqueue, claimJob, completeJob, retryJob, failJob, pendingJobCount, type Job } from "./jobs.ts";
export { hitRateLimit } from "./rate-limit.ts";
