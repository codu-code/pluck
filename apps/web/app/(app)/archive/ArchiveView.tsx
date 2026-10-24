"use client";

import type { ArchiveFilter, Item, ItemPage } from "@pluck/shared-schemas";
import { KindGlyph } from "@pluck/ui";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import { rowSite, when } from "@/lib/format";
import { moveItems } from "@/lib/moves";
import styles from "./archive.module.css";

const FILTERS: [ArchiveFilter, string][] = [["all", "All"], ["you", "By you"], ["expired", "Expired"], ["import", "Imported"]];
const BIN_DAYS = 30;

function why(item: Item, bin: boolean, now: Date): string {
  if (bin) {
    const left = BIN_DAYS - Math.floor((now.getTime() - new Date(item.deletedAt ?? item.updatedAt).getTime()) / 86_400_000);
    return `deleted, gone for good in ${Math.max(left, 1)} day${left === 1 ? "" : "s"}`;
  }
  if (item.status === "done") return "done";
  switch (item.archivedReason) {
    case "expired": return "expired, kept here";
    case "bulk": return "archived with Archive it all";
    case "import": return "imported";
    default: return "archived by you";
  }
}

// The Archive board: everything archived, done or expired, with Restore. The bin is a view of its own.
export function ArchiveView({ initial, bin }: { initial: ItemPage; bin: boolean }) {
  const [rows, setRows] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [toast, showToast] = useToast();
  const now = new Date();

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
    if (!ok) return showToast({ message: "That did not go through." });
    setRows((cur) => cur.filter((r) => r.id !== item.id));
    showToast({
      message: bin ? "Out of the bin." : "Back in the Inbox.",
      undo: bin
        ? () => void fetch(`/api/v1/items/${item.id}`, { method: "DELETE" }).then(() => load(filter))
        : () => void moveItems([item.id], item.status).then(() => load(filter)),
    });
  }

  return (
    <>
      <TopBar onPluck={() => showToast({ message: "Plucked to the Inbox." })} />
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>{bin ? "Bin" : "Archive"}</h1>
          <span className={styles.subtitle}>
            {bin
              ? "Things you deleted. Each one is gone for good 30 days after you deleted it."
              : "Everything you archived, finished, or let expire. Nothing is ever deleted, and search still finds it."}
          </span>
        </div>
        {!bin && (
          <div role="group" aria-label="Filter" className={styles.chips}>
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} className={styles.chip} onClick={() => { setFilter(value); void load(value); }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className={styles.rows} role="list" aria-label={bin ? "Bin" : "Archived items"}>
          {rows.map((item) => (
            <div key={item.id} role="listitem" className={styles.row}>
              <KindGlyph kind={item.kind} />
              <div className={styles.body}>
                {bin ? <span className={styles.titleText}>{item.title}</span> : <Link href={`/items/${item.id}`} className={styles.titleText}>{item.title}</Link>}
                <span className={styles.meta}>{rowSite(item)} · {why(item, bin, now)}</span>
              </div>
              <span className={styles.when}>{when(bin ? (item.deletedAt ?? item.updatedAt) : item.statusChangedAt, now)}</span>
              <button type="button" className={styles.restore} onClick={() => restore(item)}>Restore</button>
            </div>
          ))}
        </div>
        {rows.length === 0 && <p className={styles.none}>{bin ? "The bin is empty." : "Nothing here yet."}</p>}
        {nextCursor && <button type="button" className={styles.more} onClick={() => load(filter, nextCursor)}>Show more</button>}
        <p className={styles.foot}>
          {bin ? <Link href="/archive">Back to the Archive</Link> : <>Deleted something by mistake? <Link href="/archive?view=bin">The bin</Link> keeps it for 30 days.</>}
        </p>
      </div>
      {toast}
    </>
  );
}
