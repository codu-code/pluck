import { KindGlyph } from "@pluck/ui";
import { isTextKind, type Item } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { coverSrc, initials, tileIndex } from "@/lib/format";
import { useFormat } from "./useFormat";
import styles from "./ItemRow.module.css";

type Props = {
  item: Item;
  now: Date | null; // null until the page is in the browser (see useNow)
  active?: boolean; // the keyboard cursor: shows the actions
  selecting?: boolean; // bulk select: shows the checkbox
  selected?: boolean;
  leaving?: boolean; // slides out after a move
  landing?: "draft" | "fresh"; // a pluck arriving: the draft slides in, the real row washes mint then settles
  onToggle?: () => void;
  onPoint?: () => void;
  actions?: ReactNode;
  tags?: ReactNode; // chips, shown when the row is not showing its actions
  pill?: ReactNode; // "30 days" near expiry
};

// One 64px row from the Main board: cover or site tile, title, site and meta, excerpt, kind glyph and when.
export function ItemRow({ item, now, active, selecting, selected, leaving, landing, onToggle, onPoint, actions, tags, pill }: Props) {
  const t = useTranslations("app.itemRow");
  const f = useFormat();
  const site = f.site(item);
  return (
    <div
      className={styles.row}
      data-state={item.extraction.state}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-leaving={leaving || undefined}
      data-landing={landing}
      onMouseMove={onPoint} // move, not enter: a closing overlay must not steal the keyboard cursor
    >
      {selecting && (
        <input type="checkbox" className={styles.check} checked={Boolean(selected)} onChange={onToggle} aria-label={t("select", { title: item.title })} />
      )}
      {item.hasCover ? (
        // why: covers are signed S3 redirects from our own route, so next/image would only add a hop.
        <img className={styles.tile} src={coverSrc(item.id)} alt="" width={40} height={40} loading="lazy" />
      ) : !isTextKind(item.kind) ? (
        <div className={styles.tile} style={{ background: `var(--tile-${tileIndex(site)})` }} aria-hidden="true">
          {initials(item.siteName, item.url)}
        </div>
      ) : (
        <div className={`${styles.tile} ${styles.glyphTile}`} aria-hidden="true">
          <KindGlyph kind={item.kind} size={18} />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <Link href={`/items/${item.id}`} className={styles.title}>
            {item.title}
          </Link>
          <span className={item.extraction.state === "failed" ? `${styles.meta} ${styles.failed}` : styles.meta}>
            {site}{now || !item.dueAt ? ` · ${f.meta(item, now ?? undefined)}` : ""}
          </span>
        </div>
        <div className={styles.excerpt}>{item.excerpt ?? item.url ?? ""}</div>
      </div>
      {pill}
      {active && actions ? <div className={styles.actions}>{actions}</div> : tags ? <div className={styles.tags}>{tags}</div> : null}
      <div className={styles.side}>
        <KindGlyph kind={item.kind} />
        <span>{now && f.when(item.createdAt, now)}</span>
      </div>
    </div>
  );
}

export function RowAction({ label, keyHint, onClick, href }: { label: string; keyHint: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      {label} <kbd className={styles.kbd}>{keyHint}</kbd>
    </>
  );
  return href ? (
    <Link href={href} className={styles.action}>{inner}</Link>
  ) : (
    <button type="button" className={styles.action} onClick={onClick}>{inner}</button>
  );
}
