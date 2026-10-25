import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { runTap } from "@/lib/library";
import { verifyTap } from "@/lib/signed";
import { AutoSubmit } from "./AutoSubmit";

export const metadata: Metadata = { title: "Pluck", robots: { index: false } };

// The title while each action runs (app.digest.doing).
const DOING = { keep: "keep", letgo: "letGo", "undo-letgo": "undoLetGo", stop: "stop" } as const;

// The page a digest link opens. It acts with one tap through a form POST (submitted for you), so a mail
// scanner that only fetches links changes nothing. Archive it all waits for a real yes.
export default async function Tap({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ count?: string }> }) {
  const { token } = await params;
  const t = await getTranslations("app.digest");
  const tap = verifyTap(token);
  // Counting is read-only, so Archive it all shows its number straight away.
  const count = (await searchParams).count ?? (tap?.a === "archive-all" ? String((await runTap(token)).count ?? 0) : undefined);

  if (!tap)
    return (
      <Standalone art={<BigMark />} title={<>{t("expired.title")}<Dot /></>} lede={t("expired.lede")}>
        <Actions><Link href="/inbox" className={s.primary}>{t("open")}</Link></Actions>
      </Standalone>
    );

  if (tap.a === "archive-all")
    return (
      <Standalone
        title={[t("archiveAll.title1"), <>{t("archiveAll.title2")}<Dot /></>]}
        artIsContent
        art={<p className={s.bigCount}>{t.rich("archiveAll.count", { count: Number(count), b: (c) => <b>{c}</b>, span: (c) => <span>{c}</span> })}</p>}
        lede={t("archiveAll.lede")}
      >
        <Actions>
          <form method="post" action={`/api/d/${token}`}>
            <input type="hidden" name="confirm" value="1" />
            <button type="submit" className={s.primary} disabled={count === "0"}>{t("archiveAll.confirm", { count: Number(count) })}</button>
          </form>
          <Link href="/inbox" className={s.textLink}>{t("archiveAll.notNow")}</Link>
        </Actions>
      </Standalone>
    );

  return (
    <Standalone art={<BigMark />} title={<>{t(`doing.${DOING[tap.a]}`)}<Dot>…</Dot></>}>
      <form method="post" action={`/api/d/${token}`} id="tap">
        <noscript>
          <button type="submit" className={s.primary}>{t("confirm")}</button>
        </noscript>
      </form>
      <AutoSubmit formId="tap" />
    </Standalone>
  );
}
