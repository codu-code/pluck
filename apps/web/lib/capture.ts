import { getObject, keys, putObject } from "@pluck/blob";
import { applyExtraction, enqueue, nextUnsorted, recordExtractionFailure, setBlobKeys, type ExtractionResult } from "@pluck/db";
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
  kind: x.kind, preview: x.preview, facts: x.facts, title: x.title, siteName: x.siteName, author: x.author, excerpt: x.excerpt,
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
    // Shown as an article by the person's choice: its body is kept, whatever the link looks like.
    const asArticle = item.preview === "reader" && item.previewGuess !== "reader";
    const named = item.titleIsDerived && item.title !== item.url ? item.title : null; // the device's, or an earlier read's
    const x = withTranscript(await extract({ url: item.url!, html, title: named }, { signal: AbortSignal.timeout(timeoutMs), asArticle }), transcript);
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

// Items read before Previews, sorted again a few at a time from the page kept with them, so the sites see nothing;
// one with no kept page is fetched again. A title or Preview the person chose stays theirs (applyExtraction).
export async function sortBackfill(limit = 10): Promise<number> {
  const page = await nextUnsorted(limit);
  if (!page) return 0;
  for (const u of page) {
    try {
      const html = u.htmlKey ? (await getObject(u.htmlKey)).toString("utf8") : null;
      await applyExtraction(u.userId, u.itemId, toResult(await extract({ url: u.url, html, title: u.title }, { signal: AbortSignal.timeout(10_000) })));
    } catch (e) {
      log("warn", "preview backfill skipped an item", { userId: u.userId, itemId: u.itemId, error: errorText(e) }); // it keeps its old look
    }
  }
  return page.length;
}
