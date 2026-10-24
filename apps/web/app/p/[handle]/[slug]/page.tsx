import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ago, initials, tileIndex } from "@/lib/format";
import { publicPage } from "@/lib/library";
import { ReportLink } from "./ReportLink";
import styles from "./public.module.css";

export const dynamic = "force-dynamic"; // flipping a list back to Private must 404 at once

type Params = { params: Promise<{ handle: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, slug } = await params;
  const page = await publicPage(handle, slug, { count: false });
  if (!page) return { title: "Not found · Pluck" };
  const by = page.author.name ?? `@${page.author.handle}`;
  return {
    title: `${page.list.name} · a list by ${by} · Pluck`,
    description: page.list.purpose || `${page.list.itemCount} things, picked by ${by}.`,
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

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" aria-label="Pluck"><Logo size={22} /></Link>
        <Link href="/" className={styles.what}>What is Pluck?</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className={styles.meta}>
            A list by {by} · {list.itemCount} item{list.itemCount === 1 ? "" : "s"} · updated {ago(list.updatedAt)}
          </span>
          <h1 className={styles.title}>{list.name}</h1>
          {list.purpose && <p className={styles.purpose}>{list.purpose}</p>}
          <div className={styles.cta}>
            <Link href={`/copy/${list.id}`} className={styles.pluck}>
              <span className={styles.tick} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              Pluck this list
            </Link>
            <span className={styles.meta}>Copies it into your own Pluck. Free.</span>
          </div>
        </div>
        <ol className={styles.items}>
          {entries.map((e, i) => (
            <li key={e.id} className={styles.item}>
              <span className={styles.n}>{i + 1}</span>
              {e.hasCover ? (
                // why: covers come from a signed redirect on our own route; next/image would add a hop.
                <img className={styles.cover} src={`/api/v1/p/cover/${list.id}/${e.id}`} alt="" width={112} height={72} loading="lazy" />
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
        <div className={styles.footCard}>
          <div className={styles.footText}>
            <b>Make lists like this from what you save.</b>
            <span className={styles.meta}>Pluck it. Sort it later. Share it when it&apos;s good.</span>
          </div>
          <Link href={`/copy/${list.id}`} className={styles.pluckSmall}>Pluck this list</Link>
        </div>
        <div className={styles.links}>
          <ReportLink listId={list.id} />
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </main>
    </div>
  );
}
