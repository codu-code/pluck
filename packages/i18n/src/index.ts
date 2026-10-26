import app from "../messages/app/index.ts";
import email from "../messages/email/index.ts";
import extension from "../messages/extension/index.ts";
import ios from "../messages/ios/index.ts";
import share from "../messages/share/index.ts";
import site from "../messages/site/index.ts";
import { inLocale, type Messages } from "./catalog.ts";
import type { Locale } from "./locales.ts";

export * from "./locales.ts";
export type { Messages };

// Where each catalog is used: site (marketing pages), app (the signed-in web app and sign-in), email (every
// email the server sends), ios (the iPhone app), extension (the Chrome extension), share (the iPhone share sheet).
export const CATALOGS = { site, app, email, ios, extension, share } as const;
export type Surface = keyof typeof CATALOGS;

// The shape every language shares: English's, so a key that does not exist fails the typecheck.
export type CatalogOf<S extends Surface> = (typeof CATALOGS)[S]["en"];

// A surface's messages in a language, with English filling any key not translated yet.
export function messagesFor<S extends Surface>(surface: S, locale: Locale): CatalogOf<S> {
  return inLocale(CATALOGS[surface] as Record<Locale, Messages>, locale) as CatalogOf<S>;
}
