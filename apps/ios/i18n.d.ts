import type { CatalogOf, IntlLocale } from "@pluck/i18n";

// Typed keys for useTranslations: a key missing from the English catalog fails the typecheck.
declare module "use-intl" {
  interface AppConfig {
    Locale: IntlLocale;
    Messages: { ios: CatalogOf<"ios"> };
  }
}
