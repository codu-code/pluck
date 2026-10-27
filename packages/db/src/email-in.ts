import { createHash, randomBytes } from "node:crypto";
import type { Item } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { contents, emailAliases, items, oid } from "./collections.ts";
import { newItem, replucked } from "./item-doc.ts";
import { recountAround, toItem } from "./items.ts";
import { bodyForSearch, textForSearch } from "./search.ts";

// Email-in: each person has one active address, pluck+<token>@<domain>. Regenerating retires the old one.

const newToken = () => randomBytes(8).toString("hex").slice(0, 12);

export async function aliasOf(userId: string): Promise<string> {
  const col = await emailAliases();
  const uid = oid(userId);
  const current = await col.findOne({ userId: uid, active: true });
  if (current) return current.token;
  const token = newToken();
  await col.insertOne({ _id: new ObjectId(), userId: uid, token, active: true, createdAt: new Date() });
  return token;
}

export async function regenerateAlias(userId: string): Promise<string> {
  await (await emailAliases()).updateMany({ userId: oid(userId), active: true }, { $set: { active: false } });
  return aliasOf(userId);
}

export async function userForAlias(token: string): Promise<string | null> {
  const doc = await (await emailAliases()).findOne({ token: token.toLowerCase(), active: true });
  return doc ? doc.userId.toHexString() : null;
}

export type EmailItemInput = {
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  messageId: string | null;
  markdown: string;
  excerpt: string | null;
  wordCount: number;
};

// A forwarded newsletter becomes a Read item with no URL and its text kept. The same message twice is a re-pluck.
export async function createEmailItem(userId: string, m: EmailItemInput): Promise<{ item: Item; created: boolean }> {
  const uid = oid(userId);
  const now = new Date();
  const siteName = m.fromName ?? m.fromAddress?.split("@")[1] ?? "email-in";
  const hash = m.messageId ? createHash("sha256").update(`email:${m.messageId}`).digest("hex") : undefined;
  const col = await items();
  if (hash) {
    const existing = await col.findOneAndUpdate(
      { userId: uid, urlHash: hash },
      { $set: replucked(now) },
      { returnDocument: "after" },
    );
    if (existing) {
      await recountAround(userId, existing); // it may have come back from the Bin
      return { item: toItem(existing), created: false };
    }
  }
  const doc = newItem(userId, {
    kind: "link", ...(hash ? { urlHash: hash } : {}), title: m.subject, siteName, author: m.fromName, excerpt: m.excerpt, source: "email",
    wordCount: m.wordCount, extraction: { state: "done", attempts: 1, lastError: null },
    searchText: textForSearch({ excerpt: m.excerpt, siteName, author: m.fromAddress }), searchBody: bodyForSearch(m.markdown),
  }, now);
  await col.insertOne(doc);
  await (await contents()).insertOne({ _id: new ObjectId(), itemId: doc._id, userId: uid, textMarkdown: m.markdown, extractor: "email", bytes: Buffer.byteLength(m.markdown) });
  return { item: toItem((await col.findOne({ _id: doc._id }))!), created: true };
}

export async function setRawEmailKey(userId: string, itemId: string, key: string): Promise<void> {
  await (await items()).updateOne({ _id: oid(itemId), userId: oid(userId) }, { $set: { htmlKey: key } });
}
