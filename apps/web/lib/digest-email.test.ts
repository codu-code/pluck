import type { Digest } from "@pluck/shared-schemas";
import { expect, test } from "vitest";
import { digestEmail, subjectFor } from "./digest-email";

const d: Digest = {
  expiryDays: 30,
  expiring: [{ id: "a".repeat(24), title: "A field guide to design reviews", site: "example.com", movesOn: "2026-10-29T08:00:00.000Z" }],
  due: [{ id: "b".repeat(24), title: "Learn window functions", dueAt: "2026-10-30T09:00:00.000Z" }],
  oldest: [{ id: "c".repeat(24), title: "Notes on a <good> list", site: "Note", createdAt: "2026-08-01T00:00:00.000Z" }],
  quietLists: [{ id: "d".repeat(24), name: "Book, chapter 3 sources", tickedCount: 14, itemCount: 22, idleDays: 31 }],
};
const links = {
  keep: (id: string) => `https://x/d/keep-${id}`, letGo: (id: string) => `https://x/d/go-${id}`, open: (id: string) => `https://x/items/${id}`,
  list: (id: string) => `https://x/lists/${id}`, archiveAll: "https://x/d/all", settings: "https://x/settings", stop: "https://x/d/stop",
};

test("the digest reads well as plain text and keeps the copy rules", () => {
  const e = digestEmail("niall@example.test", "Niall Maher", d, links, new Date("2026-10-26T06:00:00Z"));
  expect(e.subject).toBe("One thing you plucked and forgot.");
  expect(e.text).toContain("Morning Niall. Three minutes, then get on with your week.");
  expect(e.text).toContain("UNTOUCHED FOR 30 DAYS");
  expect(e.text).toContain(`Keep: https://x/d/keep-${"a".repeat(24)}`);
  expect(e.text).toContain("move to your Archive on Thursday. Still searchable, never deleted.");
  expect(e.text).toContain("- Learn window functions, Fri");
  expect(e.text).toContain("14 of 22 ticked, 31 days");
  expect(e.text).toContain("Plain rules, no model.");
  expect(`${e.text}${(e.html ?? "").replace("<!doctype html>", "")}`).not.toContain("!"); // no exclamation marks in the copy
  expect(e.html).toContain("Notes on a &lt;good&gt; list"); // escaped
  expect(e.headers?.["List-Unsubscribe"]).toBe("<https://x/d/stop>");
  expect(subjectFor({ ...d, expiring: [], oldest: [] })).toBe("Your week in Pluck.");
});

test("the digest goes out in the recipient's language, with dates in their language and timezone", () => {
  const en = digestEmail("niall@example.test", "Niall Maher", d, links, new Date("2026-10-26T06:00:00Z"));
  const ja = digestEmail("niall@example.test", "Niall Maher", d, links, new Date("2026-10-26T06:00:00Z"), { locale: "ja" });
  expect(ja.subject).not.toBe(en.subject);
  expect(ja.text).not.toContain("Three minutes");
  expect(ja.text).toContain("Niall");
  expect(ja.text).toContain("木曜日"); // Thursday, in Japanese
  expect(ja.html).toContain('<html lang="ja">');
  expect(subjectFor({ ...d, expiring: [], oldest: [] }, "de")).not.toBe("Your week in Pluck.");
  // 08:00 UTC on Thursday is still Wednesday evening in Honolulu.
  const hnl = digestEmail("niall@example.test", "", d, links, new Date("2026-10-26T06:00:00Z"), { timeZone: "Pacific/Honolulu" });
  expect(hnl.text).toContain("move to your Archive on Wednesday.");
  expect(hnl.text.startsWith("Morning. Three minutes")).toBe(true);
});
