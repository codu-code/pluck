"use client";

import { BIN_DAYS, type ArchiveFilter, type Item, type ItemPage } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FoldHeader, useFolded } from "@/components/Fold";
import { ItemRow } from "@/components/ItemRow";
import { useToast } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import { useFormat } from "@/components/useFormat";
import { moveItems } from "@/lib/moves";
import styles from "./archive.module.css";
import { useNow } from "@/lib/use-now";

const FILTERS: ArchiveFilter[] = ["all", "you", "expired", "import"];

// Why an item is here, as an app.archive.why key and its values.
function why(item: Item, bin: boolean, now: Date, expiryDays: number | null) {
  if (bin) {
    const left = BIN_DAYS - Math.floor((now.getTime() - new Date(item.deletedAt ?? item.updatedAt).getTime()) / 86_400_000);
    return ["bin", { days: Math.max(left, 1) }] as const;
  }
  if (item.status === "done") return ["done", {}] as const;
  switch (item.archivedReason) {
    case "expired": return expiryDays ? (["expiredAfter", { days: expiryDays }] as const) : (["expired", {}] as const);
    case "bulk": return ["bulk", {}] as const;
    case "import": return ["import", {}] as const;
    default: return ["you", {}] as const;
  }
}

// When an item came here: the move for the Archive, the delete for the bin.
const movedAt = (item: Item, bin: boolean) => (bin ? (item.deletedAt ?? item.updatedAt) : item.statusChangedAt);

// Rows in runs of one month, newest first (the order they come in), keyed "2026-10".
function byMonth(items: Item[], bin: boolean): { key: string; first: Date; items: Item[] }[] {
  const groups: { key: string; first: Date; items: Item[] }[] = [];
  for (const item of items) {
    const d = new Date(movedAt(item, bin));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, first: d, items: [item] });
  }
  return groups;
}

// The Archive board: everything archived, done or expired, with Restore, by month. The bin is a view of its own.
export function ArchiveView({ initial, bin, expiryDays }: { initial: ItemPage; bin: boolean; expiryDays: number | null }) {
  const [rows, setRows] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [toast, showToast] = useToast();
  const now = useNow();
  const t = useTranslations("app.archive");
  const app = useTranslations("app");
  const f = useFormat();
  const format = useFormatter();
  const month = (d: Date) => format.dateTime(d, { month: "long", year: "numeric", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); // "October 2026", in the reader's language
  const reason = (item: Item) => {
    const [key, values] = why(item, bin, now ?? new Date(), expiryDays);
    return t(`why.${key}`, values);
  };

  async function load(f: ArchiveFilter, after?: string) {
    const qs = new URLSearchParams({ status: bin ? "bin" : "archive", archive: f, ...(after ? { cursor: after } : {}) });
    const res = await fetch(`/api/v1/items?${qs}`);
    if (!res.ok) return;
    const page = (await res.json()) as ItemPage;
    setRows((cur) => (after ? [...cur, ...page.items] : page.items));
    setNextCursor(page.nextCursor);
  }

  async function restore(item: Item) {
    const ok = bin ? (await fetch(`/api/v1/items/${item.id}/restore`, { method: "POST" })).ok : await moveItems([item.id], "inbox");
    if (!ok) return showToast({ message: app("common.didNotGoThrough") });
    setRows((cur) => cur.filter((r) => r.id !== item.id));
    showToast({
      message: bin ? t("outOfBin") : app("moved.inbox"),
      undo: bin
        ? () => void fetch(`/api/v1/items/${item.id}`, { method: "DELETE" }).then(() => load(filter))
        : () => void moveItems([item.id], item.status).then(() => load(filter)),
    });
  }

  return (
    <>
      <TopBar onPluck={() => showToast({ message: app("common.pluckedToInbox") })} />
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>{bin ? t("bin") : t("title")}</h1>
          <span className={styles.subtitle}>
            {bin ? t("binSubtitle") : t("subtitle")}
          </span>
        </div>
        {!bin && (
          <div role="group" aria-label={t("filter.label")} className={styles.chips}>
            {FILTERS.map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} className={styles.chip} onClick={() => { setFilter(value); void load(value); }}>
                {t(`filter.${value}`)}
              </button>
            ))}
          </div>
        )}
        <div className={styles.rows} role="group" aria-label={bin ? t("bin") : t("rowsLabel")}>
          {byMonth(rows, bin).map((g) => (
            <Month key={g.key} id={`${bin ? "bin" : "archive"}-${g.key}`} label={month(g.first)} count={g.items.length}>
              {g.items.map((item) => (
                <div key={item.id} role="listitem">
                  <ItemRow
                    item={item}
                    now={now}
                    href={bin ? null : undefined}
                    meta={`${f.site(item)} · ${reason(item)}`}
                    whenIso={movedAt(item, bin)}
                    trail={<button type="button" className={styles.restore} onClick={() => restore(item)}>{t("restore")}</button>}
                  />
                </div>
              ))}
            </Month>
          ))}
        </div>
        {rows.length === 0 && <p className={styles.none}>{bin ? t("binEmpty") : t("empty")}</p>}
        {nextCursor && <button type="button" className={styles.more} onClick={() => load(filter, nextCursor)}>{app("common.showMore")}</button>}
        <p className={styles.foot}>
          {bin ? <Link href="/archive">{t("back")}</Link> : t.rich("binLink", { bin: (c) => <Link href="/archive?view=bin">{c}</Link> })}
        </p>
      </div>
      {toast}
    </>
  );
}

// One month: its header folds the rows under it, remembered on this device.
function Month({ id, label, count, children }: { id: string; label: string; count: number; children: ReactNode }) {
  const [folded, toggle] = useFolded(id);
  return (
    <section>
      <FoldHeader id={id} label={label} count={count} folded={folded} onToggle={toggle} />
      <div id={id} role="list" aria-label={label} hidden={folded}>{children}</div>
    </section>
  );
}
