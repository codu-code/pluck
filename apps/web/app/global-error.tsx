"use client";

import en from "@pluck/i18n/messages/app/en.json";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { fredoka, geist, geistMono } from "./fonts";
import "./globals.css";

// When the root layout itself fails, this replaces it, so it brings its own html, fonts, styles and words. The
// layout is what knows the language, so this page is English: only its own messages ship with it.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${fredoka.variable}`}>
      <body>
        <NextIntlClientProvider locale="en" messages={{ app: { globalError: en.globalError, standalone: en.standalone } }}>
          <Broke reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function Broke({ reset }: { reset: () => void }) {
  const t = useTranslations("app.globalError");
  return (
    <Standalone art={<BigMark />} title={<>{t("title")}<Dot /></>} lede={t("lede")}>
      <Actions>
        <button type="button" className={s.primary} onClick={reset}>{t("tryAgain")}</button>
      </Actions>
    </Standalone>
  );
}
