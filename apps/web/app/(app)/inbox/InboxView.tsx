"use client";

import type { Item, ItemPage, PluckResponse } from "@pluck/shared-schemas";
import { useEffect, useState } from "react";
import { EmptyInbox } from "@/components/EmptyInbox";
import { ItemRow } from "@/components/ItemRow";
import { KindChips, kindsFor, matches, type KindFilter } from "@/components/KindChips";
import { TopBar, type PluckDraft } from "@/components/TopBar";
import styles from "./inbox.module.css";

const SAMPLE_URL = "https://getpluck.io/sample";
const WATCH_MS = 30_000; // how long a fresh pluck is polled for its title and cover

type Row = Item & { draft?: string };

// Rows that show the instant a pluck is sent, replaced by the real items when the server answers.
function placeholders(d: PluckDraft): Row[] {
  const now = new Date().toISOString();
  const base = {
    canonicalUrl: null, titleIsDerived: true, siteName: null, author: null, excerpt: null, hasCover: false, status: "inbox" as const,
    archivedReason: null, dueAt: null, tagIds: [], note: null, source: "web" as const, wordCount: null, lang: null,
    createdAt: now, updatedAt: now, lastTouchedAt: now, draft: d.key,
  };
  if (d.text !== null)
    return [{ ...base, id: `draft-${d.key}`, kind: d.kind ?? "note", url: null, title: d.text.split("\n")[0]!, extraction: { state: "none", attempts: 0, lastError: null } }];
  return d.urls.map((url, i) => ({ ...base, id: `draft-${d.key}-${i}`, kind: "link", url, title: url, extraction: { state: "pending", attempts: 0, lastError: null } }));
}

const settling = (it: Row, now: number) =>
  !it.draft && now - new Date(it.lastTouchedAt).getTime() < WATCH_MS &&
  (it.extraction.state === "pending" || (it.extraction.state === "done" && !it.hasCover && it.kind === "link"));

export function InboxView({ initial }: { initial: ItemPage }) {
  const [rows, setRows] = useState<Row[]>(initial.items);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [now, setNow] = useState(() => new Date());
  const [everPlucked, setEverPlucked] = useState(initial.items.length > 0);

  // Fresh plucks: the row lands at once, the title arrives with the response or the queue, the cover a moment later.
  useEffect(() => {
    const id = setInterval(async () => {
      const t = Date.now();
      setNow(new Date(t));
      const watch = rows.filter((r) => settling(r, t));
      if (!watch.length) return;
      const fresh = await Promise.all(
        watch.map((r) => fetch(`/api/v1/items/${r.id}`).then((res) => (res.ok ? (res.json() as Promise<{ item: Item }>) : null))),
      );
      setRows((cur) => cur.map((r) => fresh.find((f) => f?.item.id === r.id)?.item ?? r));
    }, 1500);
    return () => clearInterval(id);
  }, [rows]);

  async function changeFilter(next: KindFilter) {
    setFilter(next);
    const kinds = kindsFor(next);
    const res = await fetch(`/api/v1/items?status=inbox${kinds ? `&kinds=${kinds.join(",")}` : ""}`);
    if (res.ok) setRows(((await res.json()) as ItemPage).items);
  }

  const onPluck = (d: PluckDraft) => {
    setEverPlucked(true);
    const drafts = placeholders(d);
    if (drafts.some((r) => !matches(filter, r.kind))) void changeFilter("all");
    setRows((cur) => [...drafts, ...cur]);
  };
  // A re-pluck returns an existing item: it moves to the top instead of appearing twice.
  const onPlucked = (d: PluckDraft, { results }: PluckResponse) => {
    const ids = new Set(results.map((r) => r.item.id));
    setRows((cur) => [...results.map((r) => r.item), ...cur.filter((r) => r.draft !== d.key && !ids.has(r.id))]);
  };
  const onFailed = (d: PluckDraft) => setRows((cur) => cur.filter((r) => r.draft !== d.key));

  const empty = !everPlucked && rows.length === 0;
  return (
    <>
      <TopBar sample={empty ? SAMPLE_URL : undefined} emphasis={empty} onPluck={onPluck} onPlucked={onPlucked} onFailed={onFailed} />
      {empty ? (
        <EmptyInbox />
      ) : (
        <div className={styles.page}>
          <div className={styles.head}>
            <h1 className={styles.title}>Inbox</h1>
          </div>
          <KindChips value={filter} onChange={changeFilter} />
          <div className={styles.rows} aria-label="Inbox items" role="list">
            {rows.map((r) => (
              <div role="listitem" key={r.id}>
                <ItemRow item={r} now={now} />
              </div>
            ))}
          </div>
          {rows.length === 0 && <p className={styles.none}>Nothing of this kind in the Inbox.</p>}
        </div>
      )}
    </>
  );
}
