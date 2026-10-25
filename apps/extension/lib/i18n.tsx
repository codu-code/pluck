import { formatLocale, messagesFor } from "@pluck/i18n";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import { locale } from "./t";

export { locale };

export function I18n({ children }: { children: ReactNode }) {
  return <IntlProvider locale={formatLocale(locale)} messages={{ extension: messagesFor("extension", locale) }}>{children}</IntlProvider>;
}
