import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export const metadata: Metadata = { title: "Pluck", robots: { index: false } };

// The title (its last full stop drawn in the accent) and the line under it, per action (app.digest.done).
const SAID = { keep: "keep", letgo: "letGo", "undo-letgo": "undoLetGo", stop: "stop", "archive-all": "archiveAll" } as const;

export default async function Done({ searchParams }: { searchParams: Promise<{ a?: string; undo?: string; count?: string }> }) {
  const { a, undo, count } = await searchParams;
  const t = await getTranslations("app.digest");
  const key = a && Object.hasOwn(SAID, a) ? SAID[a as keyof typeof SAID] : "done";
  const title = t(`done.${key}.title`, { count: Number(count ?? 0) }); // "Gone. Well, archived" breaks after "Gone."
  const line = key === "undoLetGo" || key === "done" ? "" : t(`done.${key}.line`);
  return (
    <Standalone title={title.split(". ").map((part, i, all) => (i < all.length - 1 ? `${part}.` : <>{part}<Dot /></>))} lede={line || undefined} art={<BigMark />}>
      <p className={s.srOnly} role="status">{`${title}.${line ? ` ${line}` : ""}`}</p>
      <Actions>
        <Link href="/inbox" className={s.primary}>{t("open")}</Link>
        {undo && (
          <form method="post" action={`/api/d/${undo}`}>
            <button type="submit" className={s.secondary}>{t("undo")}</button>
          </form>
        )}
      </Actions>
    </Standalone>
  );
}
