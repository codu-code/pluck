import { isTask, isTextKind, type Kind, type Status } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { oid, type ItemDoc } from "./collections.ts";

// What an Item is and how it may change. Every writer makes its new Item here and every edit asks here whether it
// fits, so a new field or rule is one change.

// A whole new Item: in the Inbox, touched now, nothing read yet. `fields` sets what this writer knows.
export function newItem(userId: string, fields: Pick<ItemDoc, "kind" | "title" | "source"> & Partial<ItemDoc>, now: Date): ItemDoc {
  return {
    _id: new ObjectId(), userId: oid(userId), url: null, canonicalUrl: null, titleIsDerived: true, siteName: null, author: null, excerpt: null,
    coverKey: null, htmlKey: null, status: "inbox", archivedReason: null, dueAt: null, tagIds: [], note: null, readingProgress: 0,
    wordCount: null, lang: null, extraction: { state: "pending", attempts: 0, lastError: null }, createdAt: now, updatedAt: now,
    lastOpenedAt: null, lastTouchedAt: now, statusChangedAt: now, deletedAt: null, ...fields,
  };
}

// The fields a status change sets: archived by the person is "user"; leaving the archive clears the reason.
export function statusFields(status: Status, now: Date): Pick<ItemDoc, "status" | "statusChangedAt" | "archivedReason"> {
  return { status, statusChangedAt: now, archivedReason: status === "archived" ? "user" : null };
}

// Re-pluck: the Item already there goes back to the Inbox, out of the Bin, and is touched. Never a second Item.
export const replucked = (now: Date) => ({ ...statusFields("inbox", now), deletedAt: null, lastTouchedAt: now, updatedAt: now });

// What an upsert writes only when it makes the Item: Mongo refuses a field in both $set and $setOnInsert.
export const onInsert = (doc: ItemDoc, set: object): Partial<ItemDoc> => Object.fromEntries(Object.entries(doc).filter(([k]) => !(k in set)));

// Why a change does not fit an Item of this Kind, or null when it does; an edit and a batch refuse on the same rule.
// Text and the text Kinds belong to Notes, Todos and Things, the link Kinds to the rest, and Done to the Kind it ends with.
export function misfit(kind: Kind, change: { kind?: Kind; status?: Status; text?: string }): string | null {
  const text = isTextKind(kind);
  if (change.text !== undefined && !text) return "Only notes, todos and things have text to edit.";
  if (change.kind && text !== isTextKind(change.kind)) return text ? "This can be a Note, Todo or Thing." : "A link can be Read, Watch, PDF or Image.";
  if (change.status === "done" && !isTask(change.kind ?? kind)) return "Done is for todos and things.";
  return null;
}
