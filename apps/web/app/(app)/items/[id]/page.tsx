import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ago, sourceLabel, waybackUrl } from "@/lib/format";
import { readItem, readText } from "@/lib/library";
import { RetryButton } from "./RetryButton";
import styles from "./item.module.css";

export const metadata: Metadata = { title: "Item · Pluck" };

// The item page. Slice 2 covers the failed and pending states and a plain text view; the reader lands in slice 4.
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser())!;
  const { id } = await params;
  const item = await readItem(user.id, id).catch(() => null);
  if (!item) notFound();
  const plucked = `${sourceLabel(item.source)} · ${ago(item.createdAt)}`;

  return (
    <>
      <div className={styles.bar}>
        <Link href="/inbox" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Inbox
        </Link>
      </div>
      {item.extraction.state === "failed" && item.url ? (
        <div className={styles.page}>
          <div className={styles.head}>
            <span className={styles.meta}>{plucked}</span>
            <h1 className={styles.title}>Couldn&apos;t read this page.</h1>
            <code className={styles.url}>{item.url}</code>
          </div>
          <div className={styles.actions}>
            <RetryButton id={item.id} />
            <a className={styles.secondary} href={item.url} target="_blank" rel="noreferrer">Open original</a>
            <a className={styles.secondary} href={waybackUrl(item.url)} target="_blank" rel="noreferrer">Try the Wayback copy</a>
          </div>
          <div className={styles.tip}>
            <b>Behind a login?</b>
            <span>Pluck it from the extension to keep the page. It sends what your browser already sees.</span>
            <Link href="/connect#extension" className={styles.tipLink}>Get the extension</Link>
          </div>
          <div className={styles.kept}>
            <span className={styles.keptTitle}>Still yours</span>
            <span className={styles.meta}>The link, your note and your tags are kept. Search finds it by title and note.</span>
          </div>
        </div>
      ) : (
        <article className={styles.page}>
          <div className={styles.head}>
            <span className={styles.meta}>{item.siteName}{item.wordCount ? ` · ${Math.max(1, Math.round(item.wordCount / 230))} min` : ""}</span>
            <h1 className={styles.title}>{item.title}</h1>
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" className={styles.meta}>Open original</a>}
          </div>
          {item.extraction.state === "pending" ? (
            <p className={styles.meta}>Plucking this page. It takes a few seconds.</p>
          ) : (
            <Body userId={user.id} itemId={item.id} />
          )}
        </article>
      )}
    </>
  );
}

async function Body({ userId, itemId }: { userId: string; itemId: string }) {
  const text = await readText(userId, itemId);
  return (
    <div className={styles.body}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
