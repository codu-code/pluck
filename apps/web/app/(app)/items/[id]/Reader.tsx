"use client";

import { LINK_KINDS, type Highlight, type Item, type Kind, type ListMembership, type Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DeleteButton, ItemBar } from "@/components/ItemBar";
import { ItemLists } from "@/components/ItemLists";
import { ItemTags } from "@/components/ItemTags";
import { useFormat } from "@/components/useFormat";
import { coverSrc } from "@/lib/format";
import { paint, selectorFor } from "@/lib/highlight-dom";
import styles from "./reader.module.css";

type Toolbar = { x: number; y: number } & ({ kind: "new"; selector: Highlight["selector"] } | { kind: "existing"; id: string });

const json = (method: string, body: unknown) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The reader (Item board): kept text in serif, highlights from a selection, the note, kind and source alongside.
export function Reader({ item, html, initialHighlights, showCover, tags, lists }: { item: Item; html: string; initialHighlights: Highlight[]; showCover: boolean; tags: Tag[]; lists: ListMembership[] }) {
  const article = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [progress, setProgress] = useState(item.readingProgress);
  const [note, setNote] = useState(item.note ?? "");
  const [kind, setKind] = useState<Kind>(item.kind);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const saved = useRef(item.readingProgress);
  const t = useTranslations("app.reader");
  const app = useTranslations("app");
  const f = useFormat();

  useLayoutEffect(() => {
    if (article.current) paint(article.current, html, highlights);
  }, [html, highlights]);

  // Opening is a touch; resume where you left off.
  useEffect(() => {
    void fetch(`/api/v1/items/${item.id}/open`, { method: "POST" });
    const el = article.current;
    if (el && item.readingProgress > 0.05 && item.readingProgress < 0.98) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + el.offsetHeight * item.readingProgress - window.innerHeight * 0.8 });
    }
  }, [item.id, item.readingProgress]);

  // Reading progress: shown live, saved every few seconds and on leave. Not a touch.
  useEffect(() => {
    const measure = () => {
      const el = article.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = Math.min(1, Math.max(0, (window.scrollY + window.innerHeight - top) / el.offsetHeight));
      setProgress(p);
    };
    const save = () => {
      const p = Math.round(progressRef.current * 100) / 100;
      if (Math.abs(p - saved.current) < 0.05) return;
      saved.current = p;
      void fetch(`/api/v1/items/${item.id}`, { ...json("PATCH", { readingProgress: p }), keepalive: true });
    };
    const timer = setInterval(save, 4000);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("pagehide", save);
    measure();
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [item.id]);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const onSelect = useCallback(() => {
    const sel = window.getSelection();
    const root = article.current;
    if (!sel || sel.isCollapsed || !root || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return setToolbar(null);
    const range = sel.getRangeAt(0);
    if (!range.toString().trim()) return setToolbar(null);
    const rect = range.getBoundingClientRect();
    setToolbar({ kind: "new", selector: selectorFor(root, range), x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  async function highlight(withNote: boolean) {
    if (toolbar?.kind !== "new") return;
    const res = await fetch("/api/v1/highlights", json("POST", { itemId: item.id, quote: toolbar.selector.textQuote.exact, selector: toolbar.selector }));
    if (!res.ok) return;
    const { highlight: h } = (await res.json()) as { highlight: Highlight };
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    setHighlights((cur) => [...cur, h]);
    if (withNote) setFocusNote(h.id);
  }

  async function remove(id: string) {
    setToolbar(null);
    setHighlights((cur) => cur.filter((h) => h.id !== id));
    await fetch(`/api/v1/highlights/${id}`, { method: "DELETE" });
  }

  async function saveHighlightNote(id: string, value: string) {
    setHighlights((cur) => cur.map((h) => (h.id === id ? { ...h, note: value || null } : h)));
    await fetch(`/api/v1/highlights/${id}`, json("PATCH", { note: value || null }));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!toolbar || e.metaKey || e.ctrlKey || e.altKey) return;
      if (toolbar.kind === "new" && (e.key === "h" || e.key === "n")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void highlight(e.key === "n");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const minutes = item.wordCount ? Math.max(1, Math.round(item.wordCount / 230)) : null;

  return (
    <>
      <ItemBar
        item={item}
        top={
          <div className={styles.progress} role="progressbar" aria-label={t("progress")} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
        }
      />
      <div className={styles.layout}>
        <article className={styles.article}>
          <div className={styles.head}>
            <span className={styles.meta}>
              {[item.siteName, minutes && t("minutes", { n: minutes }), app(`format.sourceAgo.${item.source}`, { ago: f.ago(item.createdAt) })].filter(Boolean).join(" · ")}
            </span>
            <h1 className={styles.title}>{item.title}</h1>
            {item.author && <span className={styles.byline}>{t("by", { author: item.author })}</span>}
          </div>
          {showCover && item.kind !== "image" && <img className={styles.cover} src={coverSrc(item.id)} alt="" />}
          {item.kind === "image" && <img className={styles.image} src={coverSrc(item.id)} alt={item.title} />}
          <div
            ref={article}
            className={styles.body}
            onMouseUp={onSelect}
            onKeyUp={onSelect}
            onClick={(e) => {
              const mark = (e.target as HTMLElement).closest("mark[data-highlight]") as HTMLElement | null;
              if (!mark || !window.getSelection()?.isCollapsed) return;
              const r = mark.getBoundingClientRect();
              setToolbar({ kind: "existing", id: mark.dataset.highlight!, x: r.left + r.width / 2, y: r.top });
            }}
          />
          {toolbar && (
            <div role="toolbar" aria-label={t("selection")} className={styles.toolbar} style={{ left: toolbar.x, top: toolbar.y }}>
              {toolbar.kind === "new" ? (
                <>
                  <button type="button" className={styles.tool} onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(false)}>
                    {t("highlight")} <kbd className={styles.toolKey}>h</kbd>
                  </button>
                  <button type="button" className={styles.tool} onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(true)}>
                    {t("noteTool")} <kbd className={styles.toolKey}>n</kbd>
                  </button>
                </>
              ) : (
                <button type="button" className={styles.tool} onClick={() => remove(toolbar.id)}>
                  {t("removeHighlight")}
                </button>
              )}
            </div>
          )}
        </article>
        <aside aria-label={t("about")} className={styles.aside}>
          <label className={styles.group}>
            <span className={styles.groupTitle}>{t("note")}</span>
            <textarea
              className={styles.note}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => void fetch(`/api/v1/items/${item.id}`, json("PATCH", { note: note || null }))}
            />
          </label>
          <ItemTags item={item} vocabulary={tags} />
          <label className={styles.group}>
            <span className={styles.groupTitle}>{t("kind")}</span>
            <select
              className={styles.select}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Kind;
                setKind(k);
                void fetch(`/api/v1/items/${item.id}`, json("PATCH", { kind: k }));
              }}
            >
              {LINK_KINDS.map((k) => (
                <option key={k} value={k}>{app(`kind.${k}`)}</option>
              ))}
            </select>
          </label>
          <ItemLists itemId={item.id} initial={lists} />
          <div className={styles.group}>
            <span className={styles.groupTitle}>{t("highlights", { count: highlights.length })}</span>
            {highlights.length === 0 && <span className={styles.meta}>{t("noHighlights")}</span>}
            {highlights.map((h) => (
              <div key={h.id} className={styles.highlight}>
                <blockquote className={styles.quote}>{h.quote}</blockquote>
                <label className={styles.highlightNote}>
                  <span className={styles.visuallyHidden}>{t("highlightNote")}</span>
                  <input
                    type="text"
                    defaultValue={h.note ?? ""}
                    placeholder={t("addNote")}
                    autoFocus={focusNote === h.id}
                    onBlur={(e) => e.target.value !== (h.note ?? "") && void saveHighlightNote(h.id, e.target.value)}
                    className={styles.highlightInput}
                  />
                </label>
                <button type="button" className={styles.remove} onClick={() => remove(h.id)} aria-label={t("removeLabel", { quote: h.quote.slice(0, 40) })}>
                  {app("common.remove")}
                </button>
              </div>
            ))}
          </div>
          <div className={styles.foot}>
            <span>{t("source", { via: app(`format.via.${item.source}`) })}</span>
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" className={styles.original}>{app("common.openOriginal")}</a>}
            <DeleteButton id={item.id} />
          </div>
        </aside>
      </div>
    </>
  );
}
