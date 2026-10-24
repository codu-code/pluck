"use client";

import type { Item, ItemPage } from "@pluck/shared-schemas";
import { useEffect, useState } from "react";
import { EmptyInbox } from "@/components/EmptyInbox";
import { ItemRow } from "@/components/ItemRow";
import { TopBar } from "@/components/TopBar";
import styles from "./inbox.module.css";

const SAMPLE_URL = "https://getpluck.io/sample";
const WATCH_MS = 20_000; // how long a fresh pluck is polled for its title and cover

type Row = Item & { optimistic?: true };

function placeholder(url: string): Row {
  const now = new Date().toISOString();
  return {
    id: `pending-${url}`, kind: "link", url, canonicalUrl: null, title: url, titleIsDerived: true, siteName: null, author: null,
    excerpt: null, hasCover: false, status: "inbox", archivedReason: null, dueAt: null, tagIds: [], note: null, source: "web",
    wordCount: null, lang: null, extraction: { state: "pending", attempts: 0, lastError: null }, createdAt: now, updatedAt: now,
    lastTouchedAt: now, optimistic: true,
  };
}

const settling = (it: Row, now: number) =>
  !it.optimistic && now - new Date(it.lastTouchedAt).getTime() < WATCH_MS && (it.extraction.state === "pending" || (it.extraction.state === "done" && !it.hasCover && it.kind === "link"));

export function InboxView({ initial }: { initial: ItemPage }) {
  const [rows, setRows] = useState<Row[]>(initial.items);
  const [now, setNow] = useState(() => new Date());

  // Fresh plucks: the row lands at once, title arrives with the response, cover a moment later.
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

  const onPluck = (url: string) => setRows((cur) => [placeholder(url), ...cur]);
  // A re-pluck returns an existing item: it moves to the top instead of appearing twice.
  const onPlucked = ({ item }: { item: Item }, url: string) =>
    setRows((cur) => [item, ...cur.filter((r) => r.id !== item.id && r.id !== `pending-${url}`)]);
  const onFailed = (url: string) => setRows((cur) => cur.filter((r) => r.id !== `pending-${url}`));

  const empty = rows.length === 0;
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
          <div className={styles.rows} aria-label="Inbox items" role="list">
            {rows.map((r) => (
              <div role="listitem" key={r.id}>
                <ItemRow item={r} now={now} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
