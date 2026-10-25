import app from "../messages/app/index.ts";
import email from "../messages/email/index.ts";
import extension from "../messages/extension/index.ts";
import ios from "../messages/ios/index.ts";
import share from "../messages/share/index.ts";
import site from "../messages/site/index.ts";
import { DEFAULT_LOCALE, type Locale } from "./locales.ts";

export * from "./locales.ts";

// Where each catalog is used: site (marketing pages), app (the signed-in web app and sign-in), email (every
// email the server sends), ios (the iPhone app), extension (the Chrome extension), share (the iPhone share sheet).
export const CATALOGS = { site, app, email, ios, extension, share } as const;
export type Surface = keyof typeof CATALOGS;
export type Messages = { [key: string]: string | Messages };

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? merge(b, v) : v;
  }
  return out;
}

// The shape every language shares: English's, so a key that does not exist fails the typecheck.
export type CatalogOf<S extends Surface> = (typeof CATALOGS)[S]["en"];

// A surface's messages in a language, with English filling any key not translated yet.
export function messagesFor<S extends Surface>(surface: S, locale: Locale): CatalogOf<S> {
  const all = CATALOGS[surface] as Record<Locale, Messages>;
  return (locale === DEFAULT_LOCALE ? all.en : merge(all.en, all[locale])) as CatalogOf<S>;
}
