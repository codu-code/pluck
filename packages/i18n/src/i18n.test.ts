import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import { CATALOGS, LOCALES, matchLocale, messagesFor, parseAcceptLanguage, type Messages, type Surface } from "./index.ts";

// Locales whose every catalog is fully translated. A locale joins this list when its translation lands, and from
// then on a missing key fails here instead of quietly showing English.
const COMPLETE: readonly string[] = ["zh-Hans", "es", "it", "pt-BR", "ja", "de"];

const flat = (m: Messages, prefix = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(m).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v]] : Object.entries(flat(v, `${prefix}${k}.`)))));

// The argument names a message uses, e.g. {count} and {name}, including inside plurals.
function args(message: string, locale: string): string[] {
  const names = new Set<string>();
  const walk = (els: ReturnType<IntlMessageFormat["getAst"]>) => {
    for (const el of els) {
      if ("value" in el && typeof el.value === "string" && el.type !== 0) names.add(el.value);
      if ("options" in el) for (const o of Object.values(el.options as Record<string, { value: typeof els }>)) walk(o.value);
      if ("children" in el) walk(el.children as typeof els);
    }
  };
  walk(new IntlMessageFormat(message, locale).getAst());
  return [...names].sort();
}

describe.each(Object.keys(CATALOGS) as Surface[])("%s catalog", (surface) => {
  const en = flat(CATALOGS[surface].en);

  test("English parses", () => {
    for (const [key, message] of Object.entries(en)) expect(() => args(message, "en"), key).not.toThrow();
  });

  test.each(LOCALES.filter((l) => l !== "en"))("%s: only English's keys, the same arguments, and it parses", (locale) => {
    const tr = flat((CATALOGS[surface] as Record<string, Messages>)[locale]!);
    for (const [key, message] of Object.entries(tr)) {
      expect(en[key], `${locale} has ${key}, which English does not`).toBeDefined();
      expect(args(message, locale), `${locale} ${key}`).toEqual(args(en[key]!, "en"));
    }
    if (COMPLETE.includes(locale)) expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });
});

test("untranslated keys fall back to English", () => {
  const all = CATALOGS.email as Record<string, Messages>;
  const real = all.es!;
  all.es = { magicLink: { subject: "Tu enlace" } }; // a catalog with one key translated, the rest missing
  try {
    const es = messagesFor("email", "es");
    expect(es.magicLink.subject).toBe("Tu enlace");
    expect(es.magicLink.intro).toBe(CATALOGS.email.en.magicLink.intro);
  } finally {
    all.es = real;
  }
});

test("a browser's or a phone's languages pick the first one Pluck speaks", () => {
  expect(matchLocale(parseAcceptLanguage("fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"))).toBe("fr");
  expect(matchLocale(parseAcceptLanguage("en;q=0.5,pt-PT;q=0.9"))).toBe("pt-BR");
  expect(matchLocale(["zh-CN"])).toBe("zh-Hans");
  expect(matchLocale(["zh-Hans-HK"])).toBe("zh-Hans");
  expect(matchLocale(["zh-TW", "ja-JP"])).toBe("ja"); // Traditional Chinese is not translated, so the next choice wins
  expect(matchLocale(["es_419"])).toBe("es");
  expect(matchLocale(["sv-SE", "fi"])).toBe("en");
  expect(matchLocale(parseAcceptLanguage(null))).toBe("en");
  expect(matchLocale(parseAcceptLanguage("de;q=0, nl"))).toBe("nl"); // q=0 means not this one
});

test("the argument check sees plurals and nested arguments", () => {
  expect(args("Hi {name}, {count, plural, one {# Item from {site}} other {# Items}}", "en")).toEqual(["count", "name", "site"]);
  expect(args("Hola, {count, plural, one {# elemento} other {# elementos}}", "es")).toEqual(["count"]); // {name} dropped: caught
});
