import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ago, initials, tileIndex } from "@/lib/format";
import { readShared } from "@/lib/library";
import styles from "../../p/[handle]/[slug]/public.module.css";
import { LeaveButton } from "./LeaveButton";

export const metadata: Metadata = { title: "Shared with you · Pluck" };
export const dynamic = "force-dynamic"; // taken back by its owner means gone at once

// A List someone shared with you, See only: the public page's view and frame (packages/db/src/public.ts).
// The email link lands here; signing in with that address is what lets you in.
export default async function SharedListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/shared/${id}`)}`);
  const page = await readShared(user.id, id).catch(() => null);
  if (!page) notFound();
  const { list, author, entries } = page;
  const by = author.name ? `${author.name} (@${author.handle})` : `@${author.handle}`;
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/inbox" aria-label="Pluck, your Inbox"><Logo size={22} /></Link>
        <Link href="/lists" className={styles.what}>Your Lists</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.meta}>Shared with you by {by} · {list.itemCount} item{list.itemCount === 1 ? "" : "s"} · updated {ago(list.updatedAt)}</span>
          <h1 className={styles.title}>{list.name}</h1>
          {list.purpose && <p className={styles.purpose}>{list.purpose}</p>}
          <div className={styles.cta}>
            <Link href={`/copy/${list.id}`} className={styles.pluck}>Pluck this list</Link>
            <span className={styles.meta}>You can see it; only they change it. Pluck it for a copy of your own.</span>
          </div>
        </div>
        <ol className={styles.items}>
          {entries.map((e, i) => (
            <li key={e.id} className={styles.item}>
              <span className={styles.n}>{i + 1}</span>
              {e.hasCover ? (
                // why: covers come from a signed redirect on our own route; next/image would add a hop.
                <img className={styles.cover} src={`/api/v1/shared/${list.id}/items/${e.id}/cover`} alt="" width={112} height={72} loading="lazy" />
              ) : (
                <div className={styles.cover} style={{ background: `var(--tile-${tileIndex(e.siteName ?? e.title)})` }} aria-hidden="true">
                  {e.url ? initials(e.siteName, e.url) : "Note"}
                </div>
              )}
              <div className={styles.body}>
                {e.url ? (
                  <a href={e.url} className={styles.itemTitle} rel="noopener nofollow ugc" target="_blank">{e.title}</a>
                ) : (
                  <span className={styles.itemTitle}>{e.title}</span>
                )}
                {e.siteName && <span className={styles.meta}>{e.siteName}</span>}
                {e.note && <p className={styles.note}>{e.note}</p>}
              </div>
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
