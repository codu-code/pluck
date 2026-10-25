import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { useFormat } from "@/components/useFormat";
import { ItemRow, RowLead, RowNote } from "@/components/ItemRow";
import { readShared } from "@/lib/library";
import styles from "../../p/[handle]/[slug]/public.module.css";
import { LeaveButton } from "./LeaveButton";
import { NoAccess } from "./NoAccess";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("shared") };
}
export const dynamic = "force-dynamic"; // taken back by its owner means gone at once

// "Shared with you by … · 3 items · updated 10 min ago": a component, so this async page can use the formatter hook.
function Meta({ by, count, updatedAt }: { by: string; count: number; updatedAt: string }) {
  const t = useTranslations("app.shared");
  return t("meta", { by, count, ago: useFormat().ago(updatedAt) });
}

// A List someone shared with you, See only: the public page's view and frame (packages/db/src/public.ts).
// The email link lands here; signing in with that address is what lets you in.
export default async function SharedListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/shared/${id}`)}`);
  const page = await readShared(user.id, id).catch(() => null);
  if (!page) return <NoAccess listId={id} email={user.email} />;
  const { list, author, entries } = page;
  const t = await getTranslations("app.shared");
  const by = author.name ? t("byNamed", { name: author.name, handle: author.handle }) : t("byHandle", { handle: author.handle });
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/inbox" aria-label={t("home")}><Logo size={22} /></Link>
        <Link href="/lists" className={styles.what}>{t("noAccess.lists")}</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.meta}><Meta by={by} count={list.itemCount} updatedAt={list.updatedAt} /></span>
          <h1 className={styles.title}>{list.name}</h1>
          {list.purpose && <p className={styles.purpose}>{list.purpose}</p>}
          <div className={styles.cta}>
            <Link href={`/copy/${list.id}`} className={styles.pluck}>{t("pluck")}</Link>
            <span className={styles.meta}>{t("seeOnly")}</span>
          </div>
        </div>
        <ol className={styles.items}>
          {entries.map((e, i) => (
            <li key={e.id}>
              <ItemRow item={e} now={null} whenIso={null} href={e.url} cover={`/api/v1/shared/${list.id}/items/${e.id}/cover`} lead={<RowLead n={i + 1} />} below={e.note ? <RowNote text={e.note} /> : undefined} />
            </li>
          ))}
        </ol>
        <div className={styles.links}>
          <LeaveButton listId={list.id} className={styles.leave} />
        </div>
      </main>
    </div>
  );
}
