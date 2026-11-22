import { readFileSync } from "node:fs";
import { pendingJobCount } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { beginFile, fileArrived, keepFile, pluckAny, readItem, readText, setPictureFromApp } from "./index";

const PDF = readFileSync(new URL("../../../../packages/extract/fixtures/pages/doc.pdf", import.meta.url));

test("a PDF shared from the phone: the item at once, the bytes by signed upload, the text once the worker sees them", async () => {
  const { a, b } = await twoUsers();
  const { item, uploadUrl } = await beginFile(a, { name: "Estimates.pdf", contentType: "application/pdf", size: PDF.length });
  expect(item).toMatchObject({ kind: "pdf", url: null, source: "ios", extraction: { state: "pending" } });

  const key = new URL(uploadUrl).pathname.split("/").slice(2).join("/");
  await keepFile(a, item.id, key, "application/pdf", "Estimates.pdf"); // not uploaded yet: a failed try, the next one queued
  expect((await readItem(a, item.id)).extraction).toEqual({ state: "pending", attempts: 1, lastError: "The file has not arrived." });
  expect(await pendingJobCount("file")).toBe(2); // beginFile's, and the retry
  const put = (body: typeof PDF, type: string) => fetch(uploadUrl, { method: "PUT", headers: { "content-type": type }, body });
  expect((await put(Buffer.concat([PDF, PDF]), "application/pdf")).status).toBe(403); // more than was declared
  expect((await put(PDF, "text/html")).status).toBe(403); // not the type that was declared
  expect((await put(PDF, "application/pdf")).ok).toBe(true);

  await keepFile(b, item.id, key, "application/pdf", "Estimates.pdf"); // someone else's item: nothing happens
  expect((await readItem(a, item.id)).extraction.state).toBe("pending");
  await keepFile(a, item.id, key, "application/pdf", "Estimates.pdf");
  expect((await readItem(a, item.id)).extraction.state).toBe("done");
  expect((await readText(a, item.id)).length).toBeGreaterThan(20);
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("a picture dropped on the web: the upload says it is in and the Image is kept at once, only for its owner", async () => {
  const { a, b } = await twoUsers();
  const file = { name: "Poster.png", contentType: "image/png" as const };
  const { item, uploadUrl } = await beginFile(a, { ...file, size: PNG.length, source: "web" });
  expect((await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.contentType }, body: new Uint8Array(PNG) })).ok).toBe(true);
  await expect(fileArrived(b, item.id, file)).rejects.toMatchObject({ code: "not_found" }); // not theirs: nothing is read
  expect((await readItem(a, item.id)).extraction.state).toBe("pending");
  expect(await fileArrived(a, item.id, file)).toMatchObject({ kind: "image", title: "Poster", hasCover: true, source: "web", extraction: { state: "done" } });
});

test("an image the server could not fetch takes the picture the extension saw, with the page it was found on", async () => {
  const { a, b } = await twoUsers();
  const FIX = "http://127.0.0.1:4180";
  const { results } = await pluckAny(a, { url: `${FIX}/behind-a-sign-in.png`, source: "extension", foundOn: `${FIX}/news-1.html`, title: "The campaign" });
  const item = results[0]!.item;
  expect(item).toMatchObject({ kind: "link", foundOn: `${FIX}/news-1.html`, extraction: { state: "failed" } }); // a 404: final at once

  await expect(setPictureFromApp(b, item.id, PNG, "image/png")).rejects.toMatchObject({ code: "not_found" });
  const kept = await setPictureFromApp(a, item.id, PNG, "image/png");
  expect(kept).toMatchObject({ kind: "image", hasCover: true, title: "The campaign", foundOn: `${FIX}/news-1.html`, extraction: { state: "done" } });
  // Found on that is no link is left out, and a Note takes no picture.
  expect((await pluckAny(a, { url: `${FIX}/news-2.html`, foundOn: "javascript:alert(1)" })).results[0]!.item.foundOn).toBeNull();
  const note = (await pluckAny(a, { text: "words", kind: "note" })).results[0]!.item;
  await expect(setPictureFromApp(a, note.id, PNG, "image/png")).rejects.toMatchObject({ code: "bad_request" });
});
