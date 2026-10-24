"use client";

import { LINK_KINDS, type SearchResults, type Status, type Tag } from "@pluck/shared-schemas";
import { KindGlyph } from "@pluck/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { when } from "@/lib/format";
import { isTyping } from "@/lib/keys";
import styles from "./search.module.css";

type Filters = { kind: string; tag: string; status: string; date: string };
const NONE: Filters = { kind: "any", tag: "any", status: "any", date: "any" };
const STATUS_LABEL: Record<Status, string> = { inbox: "Inbox", later: "Later", archived: "Archived", done: "Done" };
const DAYS: Record<string, number> = { week: 7, month: 31, year: 365 };

function params(q: string, f: Filters, cursor?: string) {
  const p = new URLSearchParams({ q, limit: "25" });
  if (f.kind === "links") p.set("kinds", LINK_KINDS.join(","));
  else if (f.kind !== "any") p.set("kinds", f.kind);
  if (f.tag !== "any") p.set("tagIds", f.tag);
  if (f.status !== "any") p.set("status", f.status);
  if (f.date !== "any") p.set("since", new Date(Date.now() - DAYS[f.date]! * 86_400_000).toISOString());
  if (cursor) p.set("cursor", cursor);
  return p;
}

// The Search board: one box, five filter chips, ranked results with the matching words marked,
// and the honest pointer to your AI for anything "by meaning".
export function SearchView({ initialQuery, initial, tags }: { initialQuery: string; initial: SearchResults | null; tags: Tag[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(NONE);
  const [data, setData] = useState<SearchResults | null>(initial);
  const [cursor, setCursor] = useState(0);
  const [toast, showToast] = useToast();
  const input = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const now = new Date();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const query = q.trim();
    const t = setTimeout(async () => {
      router.replace(query ? `/search?q=${encodeURIComponent(query)}` : "/search", { scroll: false });
      if (!query) return setData(null);
      const res = await fetch(`/api/v1/search?${params(query, filters)}`);
      if (res.ok) {
        setData((await res.json()) as SearchResults);
        setCursor(0);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, filters, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return router.back();
      if (isTyping(e.target)) {
        if (e.key === "ArrowDown" && data?.results.length) {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      const rows = data?.results ?? [];
      if (e.key === "j" || e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, rows.length - 1));
      else if (e.key === "k" || e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
      else if ((e.key === "o" || e.key === "Enter") && rows[cursor]) router.push(`/items/${rows[cursor]!.item.id}`);
      else if (e.key === "/") input.current?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, cursor, router]);

  async function more() {
    if (!data?.nextCursor) return;
    const res = await fetch(`/api/v1/search?${params(q.trim(), filters, data.nextCursor)}`);
    if (!res.ok) return;
    const next = (await res.json()) as SearchResults;
    setData({ ...next, results: [...data.results, ...next.results] });
  }

  const prompt = `What did I pluck about ${q.trim() || "this"}?`;
  const chip = (key: keyof Filters, label: string, options: [string, string][]) => (
    <label className={styles.chip} data-on={filters[key] !== "any" || undefined}>
      <span className={styles.visuallyHidden}>{label}</span>
      <select value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))} className={styles.select}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className={styles.bar}>
        <label className={styles.box}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6L14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className={styles.visuallyHidden}>Search</span>
          <input ref={input} type="search" className={styles.input} value={q} autoFocus onChange={(e) => setQ(e.target.value)} placeholder="Search titles, notes, tags and page text" />
          <kbd className={styles.kbd}>Esc</kbd>
        </label>
      </div>
      <div className={styles.page}>
        <div className={styles.filters}>
          {chip("kind", "Kind", [["any", "Kind: any"], ["links", "Links"], ["link", "Read"], ["video", "Watch"], ["pdf", "PDF"], ["image", "Image"], ["note", "Notes"], ["todo", "Todos"], ["thing", "Things"]])}
          {chip("tag", "Tag", [["any", "Tag"], ...tags.map((t): [string, string] => [t.id, t.name])])}
          {chip("status", "Status", [["any", "Status"], ["inbox", "Inbox"], ["later", "Later"], ["archived", "Archived"], ["done", "Done"]])}
          {chip("date", "Date", [["any", "Date"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]])}
          {data && (
            <span className={styles.count}>
              {data.total} result{data.total === 1 ? "" : "s"} · title, notes, tags, list names and body
            </span>
          )}
        </div>

        {!q.trim() && <p className={styles.hint}>Type to search your whole library, the Archive included. Press / from anywhere to come here.</p>}

        {data && data.results.length > 0 && (
          <div className={styles.rows} role="list" aria-label="Results">
            {data.results.map((r, i) => (
              <div key={r.item.id} role="listitem" className={styles.row} data-active={i === cursor || undefined} onMouseEnter={() => setCursor(i)}>
                <KindGlyph kind={r.item.kind} />
                <div className={styles.body}>
                  <div className={styles.titleLine}>
                    <Link href={`/items/${r.item.id}`} className={styles.title}>{r.item.title}</Link>
                    <span className={styles.meta}>
                      {r.item.siteName ?? (r.item.url ? new URL(r.item.url).hostname : "Note")} · {STATUS_LABEL[r.item.status]}
                    </span>
                  </div>
                  {r.snippet && (
                    <div className={styles.snippet}>
                      {r.snippet.source === "note" && "Your note: “"}
                      {r.snippet.pre}
                      <mark className={styles.mark}>{r.snippet.hit}</mark>
                      {r.snippet.post}
                      {r.snippet.source === "note" && "”"}
                    </div>
                  )}
                </div>
                <span className={styles.when}>{when(r.item.createdAt, now)}</span>
              </div>
            ))}
          </div>
        )}
        {data && data.results.length === 0 && <p className={styles.hint}>Nothing matches “{q.trim()}”. Search looks for the words themselves.</p>}
        {data?.nextCursor && <button type="button" className={styles.more} onClick={more}>Show more</button>}

        {q.trim() && (
          <div className={styles.ask}>
            <span>Want it by meaning? Ask your AI.</span>
            <button
              type="button"
              className={styles.copy}
              onClick={async () => {
                await navigator.clipboard?.writeText(prompt).catch(() => {});
                showToast({ message: "Copied. Paste it into your AI." });
              }}
            >
              Copy “{prompt}”
            </button>
          </div>
        )}
      </div>
      {toast}
    </>
  );
}
