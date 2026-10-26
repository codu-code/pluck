"use client";

import { isCardPreview, textRuns, withReferral, type Item } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Player } from "@/components/Player";
import { useFormat } from "@/components/useFormat";
import { coverSrc } from "@/lib/format";
import styles from "./reader.module.css";

// The Previews that are not for reading here: a player, a post, a product, a homepage, an app. What the link is, the
// words it came with, its picture, and one clear way out to the original.
export const isCard = (item: Pick<Item, "preview">) => isCardPreview(item.preview);

export function PreviewCard({ item, text }: { item: Item; text: string }) {
  const f = useFormat();
  const site = f.site(item);
  const cover = item.hasCover ? coverSrc(item.id) : null;
  const player = item.preview === "player" && item.facts.player;
  return (
    <>
      {player ? <Player facts={item.facts} title={item.title} site={site} cover={cover} /> : cover && <img className={item.preview === "post" ? styles.postImage : styles.cover} src={cover} alt="" />}
      {text && (
        <p className={styles.said}>
          {textRuns(text).map((r, i) => (r.href ? <a key={i} href={withReferral(r.href)} target="_blank" rel="noopener">{r.text}</a> : r.text))}
        </p>
      )}
      <OpenOriginal item={item} />
    </>
  );
}

// "Open on github.com", and for a paper's landing page, its PDF too. An X Article we hold only the summary of says so.
export function OpenOriginal({ item }: { item: Item }) {
  const t = useTranslations("app.preview");
  const f = useFormat();
  if (!item.url) return null;
  return (
    <div className={styles.ways}>
      <a className={styles.primary} href={withReferral(item.url)} target="_blank" rel="noopener">{item.facts.article ? t("openArticle") : t("open", { site: f.site(item) })}</a>
      {item.facts.pdfUrl && <a className={styles.secondary} href={withReferral(item.facts.pdfUrl)} target="_blank" rel="noopener">{t("openPdf")}</a>}
    </div>
  );
}

// Under the title: the facts a Preview has (the handle, the price, the repo's language and stars, the pages).
export function PreviewFacts({ item }: { item: Item }) {
  const t = useTranslations("app.preview");
  const format = useFormatter();
  const x = item.facts;
  const bits = [
    item.preview === "product" && x.price && format.number(x.price.amount, { style: "currency", currency: x.price.currency }),
    x.language,
    typeof x.stars === "number" && t("stars", { count: x.stars }),
    x.pages && t("pages", { count: x.pages }),
  ].filter(Boolean);
  return bits.length ? <span className={item.preview === "product" ? styles.price : styles.meta}>{bits.join(" · ")}</span> : null;
}

// Show as article / Show as preview: the person's call when the guess is wrong, kept through re-plucks.
export function PreviewSwitch({ item }: { item: Item }) {
  const t = useTranslations("app.preview");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!item.previewGuess || item.previewGuess === "reader") return null;
  const reading = item.preview === "reader";
  return (
    <button type="button" className={styles.switch} disabled={busy} onClick={async () => {
      setBusy(true);
      await fetch(`/api/v1/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ preview: reading ? null : "reader" }) });
      router.refresh();
      setBusy(false);
    }}>
      {t(reading ? "asPreview" : "asArticle")}
    </button>
  );
}
