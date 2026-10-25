import { messagesFor } from "@pluck/i18n";
import { rowMeta, rowSite, when, type Item } from "@pluck/shared-schemas";
import { createFormatter, createTranslator } from "use-intl";
import { expect, test } from "vitest";
import { rowText } from "./format";

const now = new Date(2026, 9, 24, 15, 0);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const t = createTranslator({ locale: "en", messages: { ios: messagesFor("ios", "en") }, namespace: "ios" });
const f = createFormatter({ locale: "en", timeZone });
const base = { kind: "link", siteName: "Field Notes", url: "https://notes.example/a", source: "ios", extraction: { state: "done" }, wordCount: 1200, dueAt: null } as const;

test.each([
  [{ createdAt: new Date(2026, 9, 24, 14, 59, 30) }],
  [{ createdAt: new Date(2026, 9, 24, 14, 20), kind: "video", wordCount: null }],
  [{ createdAt: new Date(2026, 9, 24, 10, 0), extraction: { state: "pending" } }],
  [{ createdAt: new Date(2026, 9, 23, 22, 0), kind: "note", source: "mcp", siteName: null, url: null }],
  [{ createdAt: new Date(2026, 9, 23, 22, 0), kind: "image", source: "email", siteName: null, url: null }],
  [{ createdAt: new Date(2026, 9, 23, 22, 0), kind: "todo", dueAt: new Date(2026, 9, 25, 9, 0).toISOString() }],
])("the row says in English what shared-schemas says (%#)", (over) => {
  const item = { ...base, ...over, createdAt: over.createdAt.toISOString() } as unknown as Item;
  expect(rowText(t, f, item, now)).toMatchObject({ when: when(item.createdAt, now), site: rowSite(item), meta: rowMeta(item, now) });
});

test("dates follow the locale", () => {
  const item = { ...base, createdAt: new Date(2026, 9, 3, 9, 0).toISOString() } as unknown as Item;
  expect(rowText(t, f, item, now).when).toBe("Oct 3");
  expect(rowText(t, createFormatter({ locale: "de", timeZone }), item, now).when).toBe("3. Okt.");
});
