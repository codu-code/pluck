import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton, ItemBar } from "@/components/ItemBar";
import { currentUser } from "@/lib/auth";
import { ago, sourceLabel, waybackUrl } from "@/lib/format";
import { highlightsOf, readItem, readText } from "@/lib/library";
import { renderReader } from "@/lib/markdown";
import { NoteEditor } from "./NoteEditor";
import { Reader } from "./Reader";
import { RetryButton } from "./RetryButton";
import styles from "./item.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await currentUser();
  const item = user ? await readItem(user.id, (await params).id).catch(() => null) : null;
  return { title: item ? `${item.title} · Pluck` : "Pluck" };
}

// The item page: the reader for links, the editor for notes, todos and things, and the pending and failed states.
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser())!;
  const { id } = await params;
  const item = await readItem(user.id, id).catch(() => null);
  if (!item) notFound();
  if (item.url === null) return <NoteEditor item={item} text={await readText(user.id, item.id)} />;

  if (item.extraction.state === "done") {
    const [text, highlights] = await Promise.all([readText(user.id, item.id), highlightsOf(user.id, item.id)]);
    // The kept page usually carries its own lead image; show the cover only when it does not.
    const showCover = item.hasCover && !/!\[[^\]]*\]\(/.test(text);
    return <Reader item={item} html={renderReader(text)} initialHighlights={highlights} showCover={showCover} />;
  }

  const plucked = `${sourceLabel(item.source)} · ${ago(item.createdAt)}`;
  return (
    <>
      <ItemBar item={item} />
      {item.extraction.state === "failed" ? (
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
            <DeleteButton id={item.id} />
          </div>
        </div>
      ) : (
        <div className={styles.page}>
          <div className={styles.head}>
            <span className={styles.meta}>{plucked}</span>
            <h1 className={styles.title}>{item.title}</h1>
            <p className={styles.meta}>Plucking this page. It takes a few seconds.</p>
            <a href={item.url} target="_blank" rel="noreferrer" className={styles.meta}>Open original</a>
          </div>
        </div>
      )}
    </>
  );
}
