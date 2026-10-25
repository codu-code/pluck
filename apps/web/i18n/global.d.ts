import type { CatalogOf, Locale } from "@pluck/i18n";

// Typed keys for useTranslations and getTranslations: a key missing from the English catalog fails the typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: { site: CatalogOf<"site">; app: CatalogOf<"app"> };
  }
}
