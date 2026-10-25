"use client";

import { LINK_KINDS, type List, type SearchResults, type Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ItemRow } from "@/components/ItemRow";
import { useToast } from "@/components/Toast";
import { useFormat } from "@/components/useFormat";
import { isTyping } from "@/lib/keys";
import styles from "./search.module.css";
import { useNow } from "@/lib/use-now";

// The words before a hit, cut short so the hit itself fits on the row's one line.
const lead = (pre: string) => (pre.length > 24 ? `…${pre.slice(-24).trimStart()}` : pre);

type Filters = { kind: string; tag: string; list: string; status: string; date: string };
const NONE: Filters = { kind: "any", tag: "any", list: "any", status: "any", date: "any" };
const DAYS: Record<string, number> = { week: 7, month: 31, year: 365 };

function params(q: string, f: Filters, cursor?: string) {
  const p = new URLSearchParams({ q, limit: "25" });
  if (f.kind === "links") p.set("kinds", LINK_KINDS.join(","));
  else if (f.kind !== "any") p.set("kinds", f.kind);
  if (f.tag !== "any") p.set("tagIds", f.tag);
  if (f.list !== "any") p.set("listId", f.list);
  if (f.status !== "any") p.set("status", f.status);
  if (f.date !== "any") p.set("since", new Date(Date.now() - DAYS[f.date]! * 86_400_000).toISOString());
  if (cursor) p.set("cursor", cursor);
  return p;
}

// The Search board: one box, five filter chips, ranked results with the matching words marked,
// and the honest pointer to your AI for anything "by meaning".
export function SearchView({ initialQuery, initial, tags, lists }: { initialQuery: string; initial: SearchResults | null; tags: Tag[]; lists: List[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(NONE);
  const [data, setData] = useState<SearchResults | null>(initial);
  const [cursor, setCursor] = useState(0);
  const [toast, showToast] = useToast();
  const input = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const now = useNow();
  const t = useTranslations("app.search");
  const app = useTranslations("app");
  const f = useFormat();

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

  const prompt = q.trim() ? t("prompt", { q: q.trim() }) : t("promptThis");
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
          <span className={styles.visuallyHidden}>{t("label")}</span>
          <input ref={input} type="search" className={styles.input} value={q} autoFocus onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} />
          <kbd className={styles.kbd}>Esc</kbd>
        </label>
      </div>
      <div className={styles.page}>
        <div className={styles.filters}>
          {chip("kind", t("filters.kind"), [
            ["any", t("filters.kindAny")], ["links", app("kindChips.links")],
            ...LINK_KINDS.map((k): [string, string] => [k, app(`kind.${k}`)]),
            ["note", app("kindChips.note")], ["todo", app("kindChips.todo")], ["thing", app("kindChips.thing")],
          ])}
          {chip("tag", t("filters.tag"), [["any", t("filters.tag")], ...tags.map((x): [string, string] => [x.id, x.name])])}
          {chip("list", t("filters.list"), [["any", t("filters.list")], ...lists.map((l): [string, string] => [l.id, l.name])])}
          {chip("status", t("filters.status"), [["any", t("filters.status")], ...(["inbox", "later", "archived", "done"] as const).map((s): [string, string] => [s, app(`status.${s}`)])])}
          {chip("date", t("filters.date"), [["any", t("filters.date")], ["week", t("filters.week")], ["month", t("filters.month")], ["year", t("filters.year")]])}
          {data && (
            <span className={styles.count}>
              {t("count", { count: data.total })}
            </span>
          )}
        </div>

        {!q.trim() && <p className={styles.hint}>{t("hint")}</p>}

        {data && data.results.length > 0 && (
          <div className={styles.rows} role="list" aria-label={t("results")}>
            {data.results.map((r, i) => (
              <div key={r.item.id} role="listitem">
                <ItemRow
                  item={r.item}
                  now={now}
                  active={i === cursor}
                  onPoint={() => setCursor(i)}
                  meta={`${f.site(r.item)} · ${app(`status.${r.item.status}`)}`}
                  below={
                    r.snippet
                      ? t.rich(r.snippet.source === "note" ? "noteSnippet" : "snippet", {
                        pre: lead(r.snippet.pre),
                        post: r.snippet.post,
                        hit: r.snippet.hit,
                        mark: (c) => <mark className={styles.mark}>{c}</mark>,
                      })
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
        {data && data.results.length === 0 && <p className={styles.hint}>{t("none", { q: q.trim() })}</p>}
        {data?.nextCursor && <button type="button" className={styles.more} onClick={more}>{app("common.showMore")}</button>}

        {q.trim() && (
          <div className={styles.ask}>
            <span>{t("ask")}</span>
            <button
              type="button"
              className={styles.copy}
              onClick={async () => {
                await navigator.clipboard?.writeText(prompt).catch(() => {});
                showToast({ message: app("common.copiedForAi") });
              }}
            >
              {t("copy", { prompt })}
            </button>
          </div>
        )}
      </div>
      {toast}
    </>
  );
}
