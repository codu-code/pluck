import { keys, signedPutUrl } from "@pluck/blob";
import { createFileItem, enqueue } from "@pluck/db";
import { FILE_TYPES, type CreateFileItemBody, type Item } from "@pluck/shared-schemas";
import { readItem, trackPlucked } from "./items";
import { keepFile } from "./keeping";

const keyFor = (userId: string, itemId: string, contentType: CreateFileItemBody["contentType"]) =>
  contentType === "application/pdf" ? keys.file(userId, itemId, "pdf") : keys.file(userId, itemId, FILE_TYPES[contentType]);

// An Image or PDF from the phone's share sheet. The item lands at once; the bytes go straight to blob storage
// (a background upload that may finish after the extension has gone), and keepFile reads them once they are there.
export async function beginFile(userId: string, body: CreateFileItemBody): Promise<{ item: Item; uploadUrl: string }> {
  const kind = body.contentType === "application/pdf" ? "pdf" : "image";
  const item = await createFileItem(userId, { kind, title: body.name, source: body.source ?? "ios" });
  trackPlucked(userId, body.source ?? "ios", [{ item, created: true }]);
  const key = keyFor(userId, item.id, body.contentType);
  await enqueue("file", { userId, itemId: item.id, key, contentType: body.contentType, name: body.name }, { delayMs: 15_000 });
  return { item, uploadUrl: await signedPutUrl(key, body.contentType, body.size) };
}

// The upload is in: read the file now, so the picture shows at once and not at the worker's next pass. The queued
// job finds nothing left to do. A type that is not the one the upload was made with finds no file: a failed try.
export async function fileArrived(userId: string, itemId: string, body: Pick<CreateFileItemBody, "name" | "contentType">): Promise<Item> {
  await keepFile(userId, itemId, keyFor(userId, itemId, body.contentType), body.contentType, body.name);
  return readItem(userId, itemId);
}
