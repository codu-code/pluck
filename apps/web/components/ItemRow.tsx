import { KindGlyph } from "@pluck/ui";
import type { Item } from "@pluck/shared-schemas";
import Link from "next/link";
import { coverSrc, initials, rowMeta, tileIndex, when } from "@/lib/format";
import styles from "./ItemRow.module.css";

// One 64px row from the Main board: cover or site tile, title, site and meta, excerpt, kind glyph and when.
export function ItemRow({ item, now }: { item: Item; now: Date }) {
  const meta = rowMeta(item);
  const site = item.siteName ?? (item.url ? new URL(item.url).hostname : item.kind);
  return (
    <div className={styles.row} data-state={item.extraction.state}>
      {item.hasCover ? (
        // why: covers are signed S3 redirects from our own route, so next/image would only add a hop.
        <img className={styles.tile} src={coverSrc(item.id)} alt="" width={40} height={40} loading="lazy" />
      ) : item.url ? (
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
            {site} · {meta}
          </span>
        </div>
        <div className={styles.excerpt}>{item.excerpt ?? item.url}</div>
      </div>
      <div className={styles.side}>
        <KindGlyph kind={item.kind} />
        <span>{when(item.createdAt, now)}</span>
      </div>
    </div>
  );
}
