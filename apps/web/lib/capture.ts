import { keys, putObject } from "@pluck/blob";
import { applyExtraction, enqueue, recordExtractionFailure, setBlobKeys, type ExtractionResult } from "@pluck/db";
import { extract, FetchError, guardedFetch, type Extracted } from "@pluck/extract";
import type { Item } from "@pluck/shared-schemas";
import { log } from "./log";

// The page-keeping pipeline shared by the inline save and the retry worker.

export const MAX_EXTRACTION_ATTEMPTS = 4; // the inline try plus three retries
const BACKOFF_MS = [30_000, 120_000, 600_000];
export const backoffMs = (attempt: number) => BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]!;

// A 4xx (other than 408 and 429) or a refused address will not get better by waiting.
export function isPermanent(e: unknown): boolean {
  if (!(e instanceof FetchError)) return false;
  if (e.status) return e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
  return /blocked|unsupported|over \d+ bytes/.test(e.message);
}

const errorText = (e: unknown) => (e instanceof Error ? (e.name === "TimeoutError" ? "Timed out" : e.message) : String(e));

const toResult = (x: Extracted): ExtractionResult => ({
  kind: x.kind, title: x.title, siteName: x.siteName, author: x.author, excerpt: x.excerpt,
  canonicalUrl: x.canonicalUrl, lang: x.lang, wordCount: x.wordCount, markdown: x.markdown, extractor: x.extractor,
});

// Raw page, file and cover to the blob store. Covers go through the same guarded fetch as pages.
export async function storeBlobs(userId: string, itemId: string, x: Pick<Extracted, "kind" | "raw" | "coverUrl">): Promise<void> {
  const update: { coverKey?: string; htmlKey?: string } = {};
  if (x.raw) {
    const key = x.kind === "pdf" ? keys.file(userId, itemId, "pdf") : x.kind === "image" ? keys.cover(userId, itemId) : keys.html(userId, itemId);
    await putObject(key, x.raw.body, x.raw.contentType);
    if (x.kind === "image") update.coverKey = key;
    else if (x.kind !== "pdf") update.htmlKey = key;
  }
  if (x.coverUrl && !update.coverKey) {
    try {
      const img = await guardedFetch(x.coverUrl, { maxBytes: 5_000_000, accept: "image/*", signal: AbortSignal.timeout(8000) });
      if (img.contentType.startsWith("image/")) {
        await putObject(keys.cover(userId, itemId), img.body, img.contentType);
        update.coverKey = keys.cover(userId, itemId);
      }
    } catch (e) {
      log("warn", "cover fetch failed", { userId, itemId, error: errorText(e) });
    }
  }
  if (update.coverKey || update.htmlKey) await setBlobKeys(userId, itemId, update);
}

type Defer = (task: () => Promise<void>) => void;

// Captions the browser read go after the page text, so search and the AI tool read what was said.
function withTranscript(x: Extracted, transcript?: string): Extracted {
  const t = transcript?.trim();
  if (!t) return x;
  return { ...x, markdown: `${x.markdown}\n\n## Transcript\n\n${t}`, wordCount: (x.wordCount ?? 0) + t.split(/\s+/).length };
}

// One extraction attempt. On success the item is updated and blobs are stored (deferred when a caller
// is waiting). On failure the attempt is recorded and, unless it is final, a retry is queued.
export async function extractAttempt(
  userId: string,
  item: Item,
  { html, transcript, timeoutMs, defer }: { html?: string | null; transcript?: string; timeoutMs: number; defer?: Defer },
): Promise<Item> {
  const started = Date.now();
  try {
    const x = withTranscript(await extract({ url: item.url!, html }, { signal: AbortSignal.timeout(timeoutMs) }), transcript);
    const updated = (await applyExtraction(userId, item.id, toResult(x))) ?? item;
    const blobs = () =>
      storeBlobs(userId, item.id, x).catch(async (e) => {
        log("warn", "blob store failed", { userId, itemId: item.id, error: errorText(e) });
      });
    if (defer) defer(blobs);
    else await blobs();
    log("info", "extracted", { userId, itemId: item.id, durationMs: Date.now() - started, extractor: x.extractor });
    return updated;
  } catch (e) {
    const attempt = item.extraction.attempts + 1;
    const final = isPermanent(e) || attempt >= MAX_EXTRACTION_ATTEMPTS;
    const updated = (await recordExtractionFailure(userId, item.id, errorText(e), final)) ?? item;
    if (!final) await enqueue("extract", { userId, itemId: item.id }, { delayMs: backoffMs(attempt) });
    log("warn", "extraction failed", { userId, itemId: item.id, durationMs: Date.now() - started, attempt, final, error: errorText(e) });
    return updated;
  }
}
