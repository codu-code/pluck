"use client";

import { useTranslations } from "next-intl";
import { standaloneStyles as s } from "@/components/Standalone";

export function Retry() {
  const t = useTranslations("app.offline");
  return <button type="button" className={s.primary} onClick={() => location.reload()}>{t("tryAgain")}</button>;
}
