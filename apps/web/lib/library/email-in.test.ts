import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listKeys, putObject } from "@pluck/blob";
import { createEmailItem, getItemBlobKeys } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { parseEmail } from "@pluck/extract";
import { expect, test } from "vitest";
import { emailInAddress, ingestInbound, readText } from "./index";

test("email-in: the retry of a try that died after making the Item keeps the message, it does not delete the only copy", async () => {
  const { a } = await twoUsers();
  const token = (await emailInAddress(a)).match(/pluck\+(\w+)@/)![1]!;
  const eml = readFileSync(join(import.meta.dirname, "../../../../packages/extract/fixtures/email/newsletter.eml.tmpl"), "utf8").replace(/TOKEN/g, token).replace("issue-42", `issue-${Date.now()}`);
  const mail = await parseEmail(Buffer.from(eml));
  // The first try got as far as the Item: its raw message was never moved next to it.
  const { item } = await createEmailItem(a, { subject: mail.subject, fromName: mail.from.name, fromAddress: mail.from.address, messageId: mail.messageId, markdown: mail.markdown, excerpt: mail.excerpt, wordCount: mail.wordCount });
  const key = `inbound/test-retry-${Date.now()}`;
  await putObject(key, eml, "message/rfc822");

  await ingestInbound(key);
  const kept = `u/${a}/items/${item.id}/file.eml`;
  expect((await listKeys(kept)).map((k) => k.key)).toEqual([kept]); // moved, not deleted
  expect(await listKeys(key)).toEqual([]);
  expect((await getItemBlobKeys(a, item.id))?.htmlKey).toBe(kept);
  expect(await readText(a, item.id)).toContain("Short paragraphs are a kindness.");

  // The same message forwarded again is a duplicate: its object goes, the kept one stays.
  await putObject(key, eml, "message/rfc822");
  expect(await ingestInbound(key)).toBe("duplicate");
  expect(await listKeys(key)).toEqual([]);
  expect((await listKeys(kept)).length).toBe(1);
});
