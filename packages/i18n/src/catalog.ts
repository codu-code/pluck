import { DEFAULT_LOCALE, type Locale } from "./locales.ts";

export type Messages = { [key: string]: string | Messages };

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? merge(b, v) : v;
  }
  return out;
}

// A catalog in a language, with English filling any key not translated yet.
export const inLocale = (all: Record<Locale, Messages>, locale: Locale): Messages => (locale === DEFAULT_LOCALE ? all.en : merge(all.en, all[locale]));
