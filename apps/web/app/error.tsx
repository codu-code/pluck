"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

// Anything a page throws lands here instead of the framework's bare error screen.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("app.error");
  return (
    <Standalone art={<BigMark />} title={<>{t("title")}<Dot /></>} lede={t("lede")}>
      <Actions>
        <button type="button" className={s.primary} onClick={reset}>{t("tryAgain")}</button>
        <Link href="/support#bugs" className={s.textLink}>{t("report")}</Link>
      </Actions>
    </Standalone>
  );
}
