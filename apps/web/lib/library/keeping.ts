import { TooLarge, deleteObject, getObject, keys, putObject } from "@pluck/blob";
import { applyExtraction, enqueue, getItem, nextUnsorted, recordExtractionFailure, setBlobKeys, type ExtractionResult } from "@pluck/db";
import { extract, extractFile, extractFromHtml, FetchError, guardedFetch, type Extracted } from "@pluck/extract";
import { MAX_FILE_BYTES, type Item } from "@pluck/shared-schemas";
import { runQueue } from "../job-runner";
import { log } from "../log";

// Keeping an Item's page: now (a pluck waits up to `timeoutMs`), later (the job queue), from a file, or from an import.
//
// The one retry policy, counted on the Item (`extraction.attempts`): four tries in all, the later three 30 s, 2 min and
// 10 min after the one before failed; the fourth failure is final. A 4xx (other than 408 and 429), a refused address or a
// file over the limit is final at once. The job queue's own retries (job-runner.ts) only re-run a try whose outcome never
// got written, such as when the database is down.
const MAX_TRIES = 4;
const BACKOFF_MS = [30_000, 120_000, 600_000];
const QUEUED_TIMEOUT_MS = 20_000;

type Defer = (task: () => Promise<void>) => void;

function isPermanent(e: unknown): boolean {
  if (e instanceof TooLarge) return true;
  if (!(e instanceof FetchError)) return false;
  if (e.status) return e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
  return /blocked|unsupported|over \d+ bytes/.test(e.message);
}

const errorText = (e: unknown) =>
  e instanceof TooLarge ? "That file is over 50 MB."
  : !(e instanceof Error) ? String(e)
  : e.name === "TimeoutError" ? "Timed out"
  : e.name === "NoSuchKey" ? "The file has not arrived." // the phone's upload, still on its way
  : e.message;

// The one mapping from what packages/extract read to what packages/db keeps.
const toResult = (x: Extracted): ExtractionResult => ({
  kind: x.kind, preview: x.preview, facts: x.facts, title: x.title, siteName: x.siteName, author: x.author, excerpt: x.excerpt,
  canonicalUrl: x.canonicalUrl, lang: x.lang, wordCount: x.wordCount, markdown: x.markdown, extractor: x.extractor,
});

// A failed try: recorded on the Item and, unless it is final, the next one queued.
async function failed(userId: string, item: Item, e: unknown, retry: { queue: string; payload: Record<string, unknown> }, started: number): Promise<Item> {
  const attempt = item.extraction.attempts + 1;
  const final = isPermanent(e) || attempt >= MAX_TRIES;
  const updated = (await recordExtractionFailure(userId, item.id, errorText(e), final)) ?? item;
  if (!final) await enqueue(retry.queue, retry.payload, { delayMs: BACKOFF_MS[attempt - 1] });
  log("warn", "extraction failed", { userId, itemId: item.id, durationMs: Date.now() - started, attempt, final, error: errorText(e) });
  return updated;
}

// Pictures only: an SVG can carry script, and a self-host may serve its blob store from its own domain.
const picture = (contentType: string) => /^image\/(jpeg|png|webp|gif|avif)\b/i.test(contentType);

// Raw page, file and cover to the blob store. Covers go through the same guarded fetch as pages.
async function storeBlobs(userId: string, itemId: string, x: Pick<Extracted, "kind" | "raw" | "coverUrl">): Promise<void> {
  const update: { coverKey?: string; htmlKey?: string } = {};
  if (x.raw && (x.kind !== "image" || picture(x.raw.contentType))) {
    const key = x.kind === "pdf" ? keys.file(userId, itemId, "pdf") : x.kind === "image" ? keys.cover(userId, itemId) : keys.html(userId, itemId);
    await putObject(key, x.raw.body, x.raw.contentType);
    if (x.kind === "image") update.coverKey = key;
    else if (x.kind !== "pdf") update.htmlKey = key;
  }
  if (x.coverUrl && !update.coverKey) {
    try {
      const img = await guardedFetch(x.coverUrl, { maxBytes: 5_000_000, accept: "image/*", signal: AbortSignal.timeout(8000) });
      if (picture(img.contentType)) {
        await putObject(keys.cover(userId, itemId), img.body, img.contentType);
        update.coverKey = keys.cover(userId, itemId);
      }
    } catch (e) {
      log("warn", "cover fetch failed", { userId, itemId, error: errorText(e) });
    }
  }
  if (update.coverKey || update.htmlKey) await setBlobKeys(userId, itemId, update);
}

// Captions the browser read go after the page text, so search and the AI tool read what was said.
function withTranscript(x: Extracted, transcript?: string): Extracted {
  const t = transcript?.trim();
  if (!t) return x;
  return { ...x, markdown: `${x.markdown}\n\n## Transcript\n\n${t}`, wordCount: (x.wordCount ?? 0) + t.split(/\s+/).length };
}

// One try at a link's page. On success the Item is updated and blobs are stored (deferred when a caller is waiting).
export async function keepNow(
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
    return failed(userId, item, e, { queue: "extract", payload: { userId, itemId: item.id } }, started);
  }
}

// The `extract` job: the next try, if the Item still wants one.
export async function keepQueued(userId: string, itemId: string): Promise<void> {
  const item = await getItem(userId, itemId);
  if (!item || item.extraction.state !== "pending") return; // done, failed, re-plucked or gone
  await keepNow(userId, item, { timeoutMs: QUEUED_TIMEOUT_MS });
}

// Many pages are read by the job queue, so a function cut off at 60 s leaves none of them behind;
// `defer` starts on them as soon as the response is out, and the cron tick carries on with the rest.
export async function keepLater(userId: string, items: Item[], { defer }: { defer?: Defer } = {}): Promise<void> {
  for (const item of items) await enqueue("extract", { userId, itemId: item.id });
  if (!items.length) return;
  const work = async () => void (await runQueue({ extract: (p) => keepQueued(String(p.userId), String(p.itemId)) }, { queue: "extract", budgetMs: 40_000 }));
  if (defer) defer(work);
  else await work();
}

// The `file` job: an Image or PDF from the phone's share sheet, read once its upload is in blob storage.
// An upload that has not arrived yet is a failed try like any other, so the same policy waits for it.
export async function keepFile(userId: string, itemId: string, key: string, contentType: string, name: string): Promise<void> {
  const item = await getItem(userId, itemId);
  if (!item || item.extraction.state !== "pending") return;
  const started = Date.now();
  try {
    const x = await extractFile({ body: await getObject(key, { maxBytes: MAX_FILE_BYTES }), contentType, fileName: name });
    if (x.kind === "image") await setBlobKeys(userId, itemId, { coverKey: key });
    await applyExtraction(userId, itemId, toResult({ ...x, canonicalUrl: null }));
  } catch (e) {
    if (e instanceof TooLarge) await deleteObject(key);
    await failed(userId, item, e, { queue: "file", payload: { userId, itemId, key, contentType, name } }, started);
  }
}

// An imported link: a page the old app kept is read offline; without one (or with no text in it) it is fetched later.
export async function keepImported(userId: string, item: Item, { html, title, delayMs }: { html: (() => string) | null; title: string | null; delayMs: number }): Promise<void> {
  const page = html ? await extractFromHtml(html(), item.url!).catch(() => null) : null;
  if (page && page.wordCount > 0) await applyExtraction(userId, item.id, toResult({ ...page, title: title ?? page.title }));
  else await enqueue("extract", { userId, itemId: item.id }, { delayMs });
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
