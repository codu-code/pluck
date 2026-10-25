import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { linkParams } from "@/lib/signin-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.meta");
  return { title: t("signin"), robots: { index: false }, referrer: "no-referrer" };
}

// Where the email's link lands. Opening it does nothing; the button does (see lib/signin-link.ts). No auto-submit:
// some scanners run scripts, and one tap is a small price for a link that works in any company's mail.
export default async function SignInLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = linkParams(await searchParams);
  const t = await getTranslations("app.signinLink");
  if (!p.token)
    return (
      <Standalone title={<>{t("broken.title")}<Dot /></>} lede={t("broken.lede")}>
        <Actions><Link href="/signin" className={s.primary}>{t("broken.action")}</Link></Actions>
      </Standalone>
    );
  return (
    <Standalone title={[t("title1"), <>{t("title2")}<Dot /></>]} lede={t("lede")}>
      <Actions>
        <form method="post" action="/signin/link/go">
          {Object.entries(p).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <button type="submit" className={s.primary}>{t("action")}</button>
        </form>
      </Actions>
    </Standalone>
  );
}
