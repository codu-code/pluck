import { matchLocale, messagesFor } from "@pluck/i18n";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";

// The browser's language. Chrome's own UI strings (the manifest) come from public/_locales instead.
export const locale = matchLocale(navigator.languages);

export function I18n({ children }: { children: ReactNode }) {
  return <IntlProvider locale={locale} messages={{ extension: messagesFor("extension", locale) }}>{children}</IntlProvider>;
}
