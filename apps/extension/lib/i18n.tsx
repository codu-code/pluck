import { formatLocale, extensionMessages } from "@pluck/i18n/extension";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import { locale } from "./t";

export { locale };

export function I18n({ children }: { children: ReactNode }) {
  return <IntlProvider locale={formatLocale(locale)} messages={{ extension: extensionMessages(locale) }}>{children}</IntlProvider>;
}
