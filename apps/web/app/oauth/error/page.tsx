import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("oauthError"), robots: { index: false } };
}

// Where Better Auth sends a failed authorisation request (an unknown client, a wrong redirect, an expired link).
export default async function OAuthError({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error, error_description } = await searchParams;
  const t = await getTranslations("app.oauthError");
  return (
    <Standalone art={<BigMark />} title={<>{t("title")}<Dot /></>} lede={t("lede")}>
      <ol className={s.ruled}>
        <li><span className={s.n}>1</span><span>{t("step1")}</span></li>
        <li><span className={s.n}>2</span><span>{t.rich("step2", { connect: (c) => <Link href="/connect" className={s.textLink}>{c}</Link> })}</span></li>
        <li><span className={s.n}>3</span><span>{t.rich("step3", { support: (c) => <Link href="/support#ai" className={s.textLink}>{c}</Link> })}</span></li>
      </ol>
      {error && (
        <div className={s.field}>
          <span className={s.small}>{t("serverSaid")}</span>
          <code className={s.code}>{error_description || error}</code>
        </div>
      )}
    </Standalone>
  );
}
