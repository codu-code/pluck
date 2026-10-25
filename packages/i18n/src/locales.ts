// The languages Pluck speaks. English is the source; every other catalog falls back to it key by key.
export const LOCALES = ["en", "es", "pt-BR", "fr", "de", "ja", "it", "nl", "ko", "zh-Hans"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Each language in its own words, for pickers.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", es: "Español", "pt-BR": "Português (Brasil)", fr: "Français", de: "Deutsch",
  ja: "日本語", it: "Italiano", nl: "Nederlands", ko: "한국어", "zh-Hans": "简体中文",
};

export const isLocale = (s: unknown): s is Locale => typeof s === "string" && (LOCALES as readonly string[]).includes(s);

// One preferred tag (a browser's, a phone's) to a Locale, or null. Portuguese of any region reads pt-BR; Chinese
// only in Simplified script (Traditional is not translated yet, so zh-TW and zh-HK fall through).
function matchOne(tag: string): Locale | null {
  const t = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!t || t === "*") return null;
  const exact = LOCALES.find((l) => l.toLowerCase() === t);
  if (exact) return exact;
  const [lang, ...rest] = t.split("-");
  if (lang === "zh") return rest.length === 0 || rest.some((p) => ["hans", "cn", "sg", "my"].includes(p)) ? "zh-Hans" : null;
  if (lang === "pt") return "pt-BR";
  return LOCALES.find((l) => l.toLowerCase() === lang) ?? null;
}

// The first preferred tag we speak, else English.
export function matchLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const m = matchOne(tag);
    if (m) return m;
  }
  return DEFAULT_LOCALE;
}

// An Accept-Language header, most preferred first.
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  return (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}
