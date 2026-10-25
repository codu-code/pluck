"use client";

import { LOCALE_NAMES, LOCALES, type Locale } from "@pluck/i18n";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId } from "react";

// Picks the language for this browser (the pluck_locale cookie, read by i18n/request.ts). Signed in, `account`
// also keeps it on the account, which is the language emails go out in. Each language is named in its own words.
export function LanguageSelect({ namespace, account = false, className }: { namespace: "site" | "app"; account?: boolean; className?: string }) {
  const t = useTranslations(`${namespace}.language`);
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const pick = async (next: Locale) => {
    document.cookie = `pluck_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if (account)
      await fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { locale: next } }) }).catch(() => null);
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
