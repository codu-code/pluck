import { readFileSync } from "node:fs";
import { LOCALES } from "@pluck/i18n";
import { expect, test } from "vitest";
import { LOCALES as SYNCED, stale, toSwift } from "./i18n-sync.mjs";

test("the Chrome _locales and the share sheet's String Catalog match packages/i18n", () => {
  expect(stale(), "run node scripts/i18n-sync.mjs").toEqual([]);
});

test("every list of languages is the same list", () => {
  expect(SYNCED).toEqual([...LOCALES]);
  const plist = readFileSync(new URL("../apps/ios/app.config.ts", import.meta.url), "utf8").match(/CFBundleLocalizations: (\[[^\]]*\])/)?.[1];
  expect(JSON.parse(plist ?? "[]")).toEqual([...LOCALES]);
});

test("Swift placeholders keep English's numbering when a translation moves them", () => {
  expect(toSwift("Añadido a {list}", ["list"])).toBe("Añadido a %1$@");
  expect(toSwift("{b}, then {a}", ["a", "b"])).toBe("%2$@, then %1$@");
  expect(() => toSwift("{other}", ["list"])).toThrow();
});
