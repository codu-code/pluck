import { formatLocale, matchLocale, extensionMessages } from "@pluck/i18n/extension";
import { createTranslator } from "use-intl/core";

// The browser's language, for the popup, options and the service worker (which has no React).
// Chrome's own UI strings (the manifest) come from public/_locales instead.
export const locale = matchLocale(navigator.languages);
export const t = createTranslator({ locale: formatLocale(locale), messages: { extension: extensionMessages(locale) }, namespace: "extension" });
