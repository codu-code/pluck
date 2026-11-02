import { ExtensionRemovedReason } from "@pluck/shared-schemas";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("extensionBye"), robots: { index: false } };
}

// Where the browser sends someone who removed the extension. One optional question, each answer a plain link.
export default async function Bye({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const t = await getTranslations("app.extensionBye");
  const thanks = (await searchParams).thanks === "1";
  return (
    <Standalone title={<>{thanks ? t("thanks") : t("title")}<Dot /></>} lede={t("lede")} art={<BigMark />}>
      {!thanks && (
        <>
          <p className={s.lede}>{t("question")}</p>
          <Actions>
            {ExtensionRemovedReason.options.map((why) => (
              <a key={why} className={s.secondary} href={`/api/v1/extension/bye?why=${why}`} rel="nofollow">{t(`why.${why}`)}</a>
            ))}
          </Actions>
        </>
      )}
      <Actions><Link className={s.primary} href="/inbox">{t("open")}</Link></Actions>
    </Standalone>
  );
}
