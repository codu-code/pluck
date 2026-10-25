import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ItemRow, RowLead, RowNote } from "@/components/ItemRow";
import { publicPage } from "@/lib/library";
import { ReportLink } from "./ReportLink";
import styles from "./public.module.css";

export const dynamic = "force-dynamic"; // flipping a list back to Private must 404 at once

type Params = { params: Promise<{ handle: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, slug } = await params;
  const page = await publicPage(handle, slug, { count: false });
  const t = await getTranslations("site.publicList.meta");
  if (!page) return { title: t("notFound") };
  const by = page.author.name ?? `@${page.author.handle}`;
  return {
    title: t("title", { name: page.list.name, by }),
    description: page.list.purpose || t("description", { count: page.list.itemCount, by }),
    robots: page.list.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title: page.list.name, description: page.list.purpose, type: "article" },
  };
}

// The PublicList board: name, purpose, author, items in order with cover, title, site and note.
// Everything here comes from packages/db/src/public.ts, the one public projection.
export default async function PublicListPage({ params }: Params) {
  const { handle, slug } = await params;
  const viewer = await currentUser().catch(() => null);
  const page = await publicPage(handle, slug, { viewerId: viewer?.id });
  if (!page) notFound();
  const { list, author, entries } = page;
  const by = author.name ?? `@${author.handle}`;
  const t = await getTranslations("site.publicList");
  const format = await getFormatter();

  // "just now", "10 min ago", "yesterday", "on Tue", "on 3 Nov" (lib/format's ago), in the reader's language.
  const ago = (iso: string, now = new Date()) => {
    const d = new Date(iso);
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return t("ago.now");
    if (diff < 3_600_000) return t("ago.minutes", { count: Math.floor(diff / 60_000) });
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day(now) - day(d)) / 86_400_000);
    if (days === 0) return t("ago.hours", { count: Math.floor(diff / 3_600_000) });
    if (days === 1) return t("ago.yesterday");
    const date = days < 7 ? format.dateTime(d, { weekday: "short" })
      : format.dateTime(d, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
    return t("ago.on", { date });
  };

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" aria-label="Pluck"><Logo size={22} /></Link>
        <Link href="/" className={styles.what}>{t("what")}</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.meta}>
            {t("byline", { by, count: list.itemCount, when: ago(list.updatedAt) })}
          </span>
          <h1 className={styles.title}>{list.name}</h1>
          {list.purpose && <p className={styles.purpose}>{list.purpose}</p>}
          <div className={styles.cta}>
            <Link href={`/copy/${list.id}`} className={styles.pluck}>
              <span className={styles.tick} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {t("pluck")}
            </Link>
            <span className={styles.meta}>{t("copies")}</span>
          </div>
        </div>
        <ol className={styles.items}>
          {entries.map((e, i) => (
            <li key={e.id}>
              <ItemRow item={e} now={null} whenIso={null} href={e.url} cover={`/api/v1/p/cover/${list.id}/${e.id}`} lead={<RowLead n={i + 1} />} below={e.note ? <RowNote text={e.note} /> : undefined} />
            </li>
          ))}
        </ol>
        <div className={styles.footCard}>
          <div className={styles.footText}>
            <b>{t("footTitle")}</b>
            <span className={styles.meta}>{t("footBody")}</span>
          </div>
          <Link href={`/copy/${list.id}`} className={styles.pluckSmall}>{t("pluck")}</Link>
        </div>
        <div className={styles.links}>
          <ReportLink listId={list.id} />
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/terms">{t("terms")}</Link>
        </div>
      </main>
    </div>
  );
}
