import { KindGlyph } from "@pluck/ui";
import { isTextKind } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { coverSrc, initials, tileIndex } from "@/lib/format";
import { useFormat, type RowItem } from "./useFormat";
import styles from "./ItemRow.module.css";

type Props = {
  item: RowItem;
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
  // The same row on every surface; these are what differ.
  lead?: ReactNode; // a List's drag handle and order number
  href?: string | null; // where the title goes: the item page by default, the page itself on a public List, nowhere when null
  cover?: string; // the cover's address when it is not the owner's (public and shared Lists)
  meta?: string; // the line after the title when it is not "site · read time" (Archive's reason, Search's status)
  below?: ReactNode; // the second line when it is not the excerpt (a List note, a search snippet)
  whenIso?: string | null; // the date on the right: when it was plucked by default, none when null
  marked?: boolean; // marked in a List: softer, never struck through
  trail?: ReactNode; // after the kind glyph: a List's mark, Restore
};

// One 64px row from the Main board: cover or site tile, title, site and meta, excerpt, kind glyph and when.
// Every place that lists Items uses it: Inbox, Later, Archive, Search, Lists and the public and shared Lists.
export function ItemRow({
  item, now, active, selecting, selected, leaving, landing, onToggle, onPoint, actions, tags, pill, lead, href, cover, meta, below, whenIso, marked, trail,
}: Props) {
  const t = useTranslations("app.itemRow");
  const kind = useTranslations("app.kind");
  const f = useFormat();
  const site = f.site(item);
  const link = href === undefined ? `/items/${item.id}` : href;
  const external = Boolean(link && /^https?:/.test(link));
  const line = meta ?? (now || !item.dueAt ? [site, f.meta(item, now ?? undefined)].filter(Boolean).join(" · ") : site);
  const when = whenIso === undefined ? item.createdAt : whenIso;
  return (
    <div
      className={styles.row}
      data-state={item.extraction?.state}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-leaving={leaving || undefined}
      data-landing={landing}
      data-marked={marked || undefined}
      onMouseMove={onPoint} // move, not enter: a closing overlay must not steal the keyboard cursor
    >
      {lead}
      {selecting && (
        <input type="checkbox" className={styles.check} checked={Boolean(selected)} onChange={onToggle} aria-label={t("select", { title: item.title })} />
      )}
      {item.hasCover ? (
        // why: covers are signed S3 redirects from our own route, so next/image would only add a hop.
        <img className={styles.tile} src={cover ?? coverSrc(item.id)} alt="" width={40} height={40} loading="lazy" />
      ) : !isTextKind(item.kind) ? (
        <div className={styles.tile} style={{ background: `var(--tile-${tileIndex(site)})` }} aria-hidden="true">
          {initials(item.siteName, item.url)}
        </div>
      ) : (
        <div className={`${styles.tile} ${styles.glyphTile}`} aria-hidden="true">
          <KindGlyph kind={item.kind} label={kind(item.kind)} size={18} />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.titleLine}>
          {!link ? (
            <span className={styles.title}>{item.title}</span>
          ) : external ? (
            <a href={link} className={styles.title} rel="noopener nofollow ugc" target="_blank">{item.title}</a>
          ) : (
            <Link href={link} className={styles.title}>{item.title}</Link>
          )}
          <span className={item.extraction?.state === "failed" && meta === undefined ? `${styles.meta} ${styles.failed}` : styles.meta}>{line}</span>
        </div>
        <div className={styles.excerpt}>{below ?? item.excerpt ?? item.url ?? ""}</div>
      </div>
      {pill}
      {active && actions ? <div className={styles.actions}>{actions}</div> : tags ? <div className={styles.tags}>{tags}</div> : null}
      <div className={styles.side}>
        <KindGlyph kind={item.kind} label={kind(item.kind)} />
        {when !== null && <span>{now && when && f.when(when, now)}</span>}
      </div>
      {trail}
    </div>
  );
}

export function RowAction({ label, keyHint, onClick, href }: { label: string; keyHint?: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      {label} {keyHint && <kbd className={styles.kbd}>{keyHint}</kbd>}
    </>
  );
  return href ? (
    <Link href={href} className={styles.action}>{inner}</Link>
  ) : (
    <button type="button" className={styles.action} onClick={onClick}>{inner}</button>
  );
}

// The round mark at the end of a List row, worded by Kind: Read, Watched, Seen, Done. The owner's alone.
export function RowMark({ checked, word, a11y, onChange }: { checked: boolean; word: string; a11y: string; onChange: () => void }) {
  return (
    <label className={styles.mark}>
      <input type="checkbox" className={styles.markInput} checked={checked} onChange={onChange} aria-label={a11y} />
      <span className={styles.ring} aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className={styles.markWord} aria-hidden="true">{word}</span>
    </label>
  );
}

// A List row's start: the drag handle (shows on hover, owner only) and the order number.
export function RowLead({ n, handle }: { n: number; handle?: ButtonHTMLAttributes<HTMLButtonElement> }) {
  return (
    <span className={styles.lead}>
      {handle && (
        <button type="button" className={styles.handle} {...handle}>
          <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
            <path d="M4 4h.01M8 4h.01M4 8h.01M8 8h.01M4 12h.01M8 12h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <span className={styles.n}>{n}</span>
    </span>
  );
}

// A List's note on the row's second line, in place of the excerpt. One your AI wrote carries the clay dot.
export function RowNote({ text, byAi }: { text: string; byAi?: string }) {
  return (
    <span className={byAi ? `${styles.note} ${styles.noteAi}` : styles.note}>
      {byAi && <span aria-hidden="true" className={styles.dot} />}
      {text}
      {byAi && <span className={styles.byAi}> · {byAi}</span>}
    </span>
  );
}
