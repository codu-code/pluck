import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getTranslations("app.notFound"))("title")} · Pluck`, robots: { index: false } };
}

// Public pages that are private now, gone, or never were; and any address that is not a page.
export default function NotFound() {
  const t = useTranslations("app.notFound");
  return (
    <Standalone title={<>{t("title")}<Dot /></>} lede={t("lede")} art={<BigMark />}>
      <Actions>
        <Link href="/" className={s.primary}>{t("home")}</Link>
        <Link href="/support" className={s.textLink}>{t("support")}</Link>
      </Actions>
    </Standalone>
  );
}
