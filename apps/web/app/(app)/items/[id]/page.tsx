import { isTextKind, type Item } from "@pluck/shared-schemas";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { DeleteButton, ItemBar } from "@/components/ItemBar";
import { currentUser, requireUser } from "@/lib/auth";
import { useFormat } from "@/components/useFormat";
import { waybackUrl } from "@/lib/format";
import { highlightsOf, membershipsOf, readItem, readText, tagsOf } from "@/lib/library";
import { renderReader } from "@/lib/markdown";
import { NoteEditor } from "./NoteEditor";
import { Reader } from "./Reader";
import { RetryButton } from "./RetryButton";
import styles from "./item.module.css";

// One read per request: the title and the page share it.
const itemFor = cache((userId: string, id: string) => readItem(userId, id).catch(() => null));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await currentUser();
  const item = user ? await itemFor(user.id, (await params).id) : null;
  return { title: item ? (await getTranslations("app.meta"))("item", { title: item.title }) : "Pluck" };
}

// "Plucked from iOS · 10 min ago": a component, so the async page can use the formatter hook.
function Plucked({ item }: { item: Item }) {
  const f = useFormat();
  return `${f.source(item.source)} · ${f.ago(item.createdAt)}`;
}

// The item page: the reader for links, the editor for notes, todos and things, and the pending and failed states.
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const item = await itemFor(user.id, id);
  if (!item) notFound();
  const [tags, lists] = await Promise.all([tagsOf(user.id), membershipsOf(user.id, item.id)]);
  if (isTextKind(item.kind)) return <NoteEditor item={item} text={await readText(user.id, item.id)} tags={tags} lists={lists} />;

  if (item.extraction.state === "done") {
    const [text, highlights] = await Promise.all([readText(user.id, item.id), highlightsOf(user.id, item.id)]);
    // The kept page usually carries its own lead image; show the cover only when it does not.
    const showCover = item.hasCover && !/!\[[^\]]*\]\(/.test(text);
    return <Reader item={item} html={renderReader(text)} initialHighlights={highlights} showCover={showCover} tags={tags} lists={lists} />;
  }

  const url = item.url;
  if (!url) notFound(); // pending and failed only happen to items fetched from a URL
  const t = await getTranslations("app.item");
  const app = await getTranslations("app.common");
  return (
    <>
      <ItemBar item={item} />
      {item.extraction.state === "failed" ? (
        <div className={styles.page}>
          <div className={styles.head}>
            <span className={styles.meta}><Plucked item={item} /></span>
            <h1 className={styles.title}>{t("failed.title")}</h1>
            <code className={styles.url}>{url}</code>
          </div>
          <div className={styles.actions}>
            <RetryButton id={item.id} />
            <a className={styles.secondary} href={url} target="_blank" rel="noreferrer">{app("openOriginal")}</a>
            <a className={styles.secondary} href={waybackUrl(url)} target="_blank" rel="noreferrer">{t("failed.wayback")}</a>
          </div>
          <div className={styles.tip}>
            <b>{t("failed.loginTitle")}</b>
            <span>{t("failed.loginBody")}</span>
            <Link href="/connect#extension" className={styles.tipLink}>{t("failed.extension")}</Link>
          </div>
          <div className={styles.kept}>
            <span className={styles.keptTitle}>{t("failed.keptTitle")}</span>
            <span className={styles.meta}>{t("failed.keptBody")}</span>
            <DeleteButton id={item.id} />
          </div>
        </div>
      ) : (
        <div className={styles.page}>
          <div className={styles.head}>
            <span className={styles.meta}><Plucked item={item} /></span>
            <h1 className={styles.title}>{item.title}</h1>
            <p className={styles.meta}>{t("pending")}</p>
            <a href={url} target="_blank" rel="noreferrer" className={styles.meta}>{app("openOriginal")}</a>
          </div>
        </div>
      )}
    </>
  );
}
