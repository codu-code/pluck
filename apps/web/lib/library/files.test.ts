import { readFileSync } from "node:fs";
import { pendingJobCount } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { beginFile, keepFile, readItem, readText } from "./index";

const PDF = readFileSync(new URL("../../../../packages/extract/fixtures/pages/doc.pdf", import.meta.url));

test("a PDF shared from the phone: the item at once, the bytes by signed upload, the text once the worker sees them", async () => {
  const { a, b } = await twoUsers();
  const { item, uploadUrl } = await beginFile(a, { name: "Estimates.pdf", contentType: "application/pdf", size: PDF.length });
  expect(item).toMatchObject({ kind: "pdf", url: null, source: "ios", extraction: { state: "pending" } });

  const key = new URL(uploadUrl).pathname.split("/").slice(2).join("/");
  await keepFile(a, item.id, key, "application/pdf", "Estimates.pdf"); // not uploaded yet: a failed try, the next one queued
  expect((await readItem(a, item.id)).extraction).toEqual({ state: "pending", attempts: 1, lastError: "The file has not arrived." });
  expect(await pendingJobCount("file")).toBe(2); // beginFile's, and the retry
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: PDF });
  expect(put.ok).toBe(true);

  await keepFile(b, item.id, key, "application/pdf", "Estimates.pdf"); // someone else's item: nothing happens
  expect((await readItem(a, item.id)).extraction.state).toBe("pending");
  await keepFile(a, item.id, key, "application/pdf", "Estimates.pdf");
  expect((await readItem(a, item.id)).extraction.state).toBe("done");
  expect((await readText(a, item.id)).length).toBeGreaterThan(20);
});
