import { getObject, keys, signedPutUrl } from "@pluck/blob";
import { applyExtraction, createFileItem, enqueue, getItem, setBlobKeys } from "@pluck/db";
import { extractFile } from "@pluck/extract";
import { FILE_TYPES, type CreateFileItemBody, type Item } from "@pluck/shared-schemas";

const keyFor = (userId: string, itemId: string, contentType: CreateFileItemBody["contentType"]) =>
  contentType === "application/pdf" ? keys.file(userId, itemId, "pdf") : keys.file(userId, itemId, FILE_TYPES[contentType]);

// An Image or PDF from the phone's share sheet. The item lands at once; the bytes go straight to blob storage
// (a background upload that may finish after the extension has gone), and the worker reads them once they are there.
export async function beginFile(userId: string, body: CreateFileItemBody): Promise<{ item: Item; uploadUrl: string }> {
  const kind = body.contentType === "application/pdf" ? "pdf" : "image";
  const item = await createFileItem(userId, { kind, title: body.name, source: body.source ?? "ios" });
  const key = keyFor(userId, item.id, body.contentType);
  await enqueue("file", { userId, itemId: item.id, key, contentType: body.contentType, name: body.name }, { delayMs: 15_000 });
  return { item, uploadUrl: await signedPutUrl(key, body.contentType) };
}

// The worker's half. Throws while the upload has not arrived, so the job retries with backoff.
export async function finishFile(userId: string, itemId: string, key: string, contentType: string, name: string): Promise<void> {
  const item = await getItem(userId, itemId);
  if (!item || item.extraction.state !== "pending") return;
  // shortcut: an upload that never arrives leaves the item pending once the job gives up (five tries, about 15 minutes); mark it failed if that shows up.
  const body = await getObject(key); // missing yet: throws, and the job tries again later
  const x = await extractFile({ body, contentType, fileName: name });
  if (x.kind === "image") await setBlobKeys(userId, itemId, { coverKey: key });
  await applyExtraction(userId, itemId, {
    kind: x.kind, preview: x.preview, facts: x.facts, title: x.title, siteName: x.siteName, author: x.author, excerpt: x.excerpt, canonicalUrl: null, lang: x.lang,
    wordCount: x.wordCount, markdown: x.markdown, extractor: x.extractor,
  });
}
