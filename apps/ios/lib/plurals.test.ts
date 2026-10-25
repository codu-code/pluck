import { messagesFor } from "@pluck/i18n";
import { createTranslator } from "use-intl";
import { expect, test } from "vitest";

// Hermes on iOS lacks all three: Intl.PluralRules, and the Intl.Locale and Intl.getCanonicalLocales the plural polyfill
// itself needs. Node has them, so they go for the length of this test.
const MISSING = ["PluralRules", "Locale", "getCanonicalLocales"] as const;

test("plural messages format on an engine with no Intl.PluralRules, Intl.Locale or getCanonicalLocales, as Hermes on iOS", async () => {
  const native = Object.fromEntries(MISSING.map((k) => [k, Intl[k]]));
  for (const k of MISSING) Reflect.deleteProperty(Intl, k);
  try {
    await import("./plurals");
    for (const k of MISSING) expect(Intl[k], k).toBeDefined();
    const de = createTranslator({ locale: "de", messages: { ios: messagesFor("ios", "de") }, namespace: "ios" });
    expect(de("offline.waiting", { count: 1 })).toBe("Offline · 1 wartet");
    expect(de("offline.waiting", { count: 2 })).toBe("Offline · 2 warten");
    const en = createTranslator({ locale: "en-GB", messages: { ios: messagesFor("ios", "en") }, namespace: "ios" });
    expect(en("settings.days", { count: 30 })).toBe("30 days");
    const zh = createTranslator({ locale: "zh-Hans", messages: { ios: messagesFor("ios", "zh-Hans") }, namespace: "ios" });
    expect(zh("offline.waiting", { count: 3 })).toBe("离线 · 3 条等待中");
  } finally {
    for (const k of MISSING) Object.defineProperty(Intl, k, { value: native[k], configurable: true, writable: true });
  }
});
