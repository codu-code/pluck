"use client";

import { fromIntlLocale, LOCALE_NAMES, LOCALES, type Locale } from "@pluck/i18n";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { localePath, splitLocale } from "@/lib/siteUrls";

// Picks the language for this browser (the pluck_locale cookie, read by i18n/request.ts). Signed in, `account`
// also keeps it on the account, which is the language emails go out in. Each language is named in its own words.
// On the site, each language has its own URL, so the pick goes to this page's URL in it (a full load: the root layout
// holds the language, and a client navigation would keep it).
export function LanguageSelect({ namespace, account = false, className }: { namespace: "site" | "app"; account?: boolean; className?: string }) {
  const t = useTranslations(`${namespace}.language`);
  const locale = fromIntlLocale(useLocale());
  const router = useRouter();
  const id = useId();
  const pick = async (next: Locale) => {
    document.cookie = `pluck_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if (account)
      await fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { locale: next } }) }).catch(() => null);
    if (namespace === "site") return location.assign(localePath(next, splitLocale(location.pathname).path) + location.search + location.hash);
    router.refresh();
  };
  return (
    <span className={className}>
      <label htmlFor={id}>{t("label")}</label>{" "}
      <select id={id} value={locale} onChange={(e) => void pick(e.target.value as Locale)}>
        {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </span>
  );
}
