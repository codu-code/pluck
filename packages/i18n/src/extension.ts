import extension from "../messages/extension/index.ts";
import { inLocale, type Messages } from "./catalog.ts";
import type { Locale } from "./locales.ts";

// The extension's entry: its own catalog only, so the other surfaces' ten languages stay out of its bundle.
export * from "./locales.ts";
export const extensionMessages = (locale: Locale) => inLocale(extension as Record<Locale, Messages>, locale) as typeof extension.en;
