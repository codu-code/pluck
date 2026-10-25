import { messagesFor } from "@pluck/i18n";
import { createTranslator } from "use-intl";
import { expect, test } from "vitest";

test("plural messages format on an engine with no Intl.PluralRules, as Hermes on iOS", async () => {
  const native = Intl.PluralRules;
  Reflect.deleteProperty(Intl, "PluralRules");
  try {
    await import("./plurals");
    expect(Intl.PluralRules).not.toBe(native);
    const de = createTranslator({ locale: "de", messages: { ios: messagesFor("ios", "de") }, namespace: "ios" });
    expect(de("offline.waiting", { count: 1 })).toBe("Offline · 1 wartet");
    expect(de("offline.waiting", { count: 2 })).toBe("Offline · 2 warten");
    const en = createTranslator({ locale: "en-GB", messages: { ios: messagesFor("ios", "en") }, namespace: "ios" });
    expect(en("settings.days", { count: 30 })).toBe("30 days");
    const zh = createTranslator({ locale: "zh-Hans", messages: { ios: messagesFor("ios", "zh-Hans") }, namespace: "ios" });
    expect(zh("offline.waiting", { count: 3 })).toBe("离线 · 3 条等待中");
  } finally {
    Object.defineProperty(Intl, "PluralRules", { value: native, configurable: true, writable: true });
  }
});
