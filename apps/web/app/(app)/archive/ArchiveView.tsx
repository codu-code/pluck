"use client";

import { BIN_DAYS, type ArchiveFilter, type Item, type ItemPage } from "@pluck/shared-schemas";
import { KindGlyph } from "@pluck/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
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

// The Archive board: everything archived, done or expired, with Restore. The bin is a view of its own.
export function ArchiveView({ initial, bin, expiryDays }: { initial: ItemPage; bin: boolean; expiryDays: number | null }) {
  const [rows, setRows] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [toast, showToast] = useToast();
  const now = useNow();
  const t = useTranslations("app.archive");
  const app = useTranslations("app");
  const f = useFormat();
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
        <div className={styles.rows} role="list" aria-label={bin ? t("bin") : t("rowsLabel")}>
          {rows.map((item) => (
            <div key={item.id} role="listitem" className={styles.row}>
              <KindGlyph kind={item.kind} label={app(`kind.${item.kind}`)} />
              <div className={styles.body}>
                {bin ? <span className={styles.titleText}>{item.title}</span> : <Link href={`/items/${item.id}`} className={styles.titleText}>{item.title}</Link>}
                <span className={styles.meta}>{f.site(item)} · {reason(item)}</span>
              </div>
              <span className={styles.when}>{now && f.when(bin ? (item.deletedAt ?? item.updatedAt) : item.statusChangedAt, now)}</span>
              <button type="button" className={styles.restore} onClick={() => restore(item)}>{t("restore")}</button>
            </div>
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
