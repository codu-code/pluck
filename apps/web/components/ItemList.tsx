"use client";

import type { Item, ItemPage, List, PluckResponse, Status, Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyInbox, EmptyState } from "@/components/EmptyInbox";
import { ItemRow, RowAction } from "@/components/ItemRow";
import { KindChips, kindsFor, matches, type KindFilter } from "@/components/KindChips";
import { ListPicker } from "@/components/ListPicker";
import { Shortcuts } from "@/components/Shortcuts";
import { TagChip } from "@/components/TagChip";
import { TagPicker } from "@/components/TagPicker";
import { useToast } from "@/components/Toast";
import { TopBar, type PluckDraft } from "@/components/TopBar";
import { moveItems, restoreStatuses } from "@/lib/moves";
import { createListNamed, fetchLists, membershipsOf, setInList } from "@/lib/listing";
import { createTagNamed, fetchTags, setTagOn } from "@/lib/tagging";
import { isTyping } from "@/lib/keys";
import styles from "./ItemList.module.css";
import { useNow } from "@/lib/use-now";

type View = "inbox" | "later";
type Sort = "newest" | "untouched";
type Row = Item & { draft?: string };

const WATCH_MS = 30_000; // how long a fresh pluck is polled for its title and cover
const SLIDE_MS = 150; // motion token: archiveRow


// Rows that show the instant a pluck is sent, replaced by the real items when the server answers.
function placeholders(d: PluckDraft): Row[] {
  const now = new Date().toISOString();
  const base = {
    canonicalUrl: null, titleIsDerived: true, siteName: null, author: null, excerpt: null, hasCover: false, status: "inbox" as const,
    archivedReason: null, dueAt: null, tagIds: [], aiTagIds: [], note: null, source: "web" as const, wordCount: null, lang: null, readingProgress: 0, inList: false,
    createdAt: now, updatedAt: now, lastTouchedAt: now, statusChangedAt: now, deletedAt: null, draft: d.key,
  };
  if (d.text !== null)
    return [{ ...base, id: `draft-${d.key}`, kind: d.kind ?? "note", url: null, title: d.text.split("\n")[0]!, extraction: { state: "none", attempts: 0, lastError: null } }];
  return d.urls.map((url, i) => ({ ...base, id: `draft-${d.key}-${i}`, kind: "link" as const, url, title: url, extraction: { state: "pending" as const, attempts: 0, lastError: null } }));
}

const LANDING_MS = 4000; // a row created this recently washes mint when it first appears

const settling = (it: Row, now: number) =>
  !it.draft && now - new Date(it.lastTouchedAt).getTime() < WATCH_MS &&
  (it.extraction.state === "pending" || (it.extraction.state === "done" && !it.hasCover && it.kind === "link"));

type Expiry = { days: number | null; scope: "inbox_later" | "inbox" };

type Props = {
  view: View;
  initial: ItemPage;
  total: number;
  tags: Tag[];
  expiry: Expiry;
  expiringThisWeek?: number;
  deletedId?: string; // set after a delete on the item page: offers Undo from the bin
};

const SAMPLE_URL = "https://getpluck.io/sample";

// Inbox and Later: the paste box, kind chips, sort, rows, keyboard triage, bulk select and undo.
export function ItemList({ view, initial, total: initialTotal, tags: initialTags, expiry, expiringThisWeek = 0, deletedId }: Props) {
  const t = useTranslations("app.itemList");
  const app = useTranslations("app");
  const title = app(`status.${view}`);
  const empty = () => (view === "inbox" ? <EmptyInbox /> : <EmptyState title={t("later.empty.title")} body={t("later.empty.body")} />);
  const sample = view === "inbox" ? SAMPLE_URL : undefined;
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [total, setTotal] = useState(initialTotal);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [help, setHelp] = useState(false);
  const [vocab, setVocab] = useState(initialTags);
  const [tagFilter, setTagFilter] = useState<Tag | null>(null);
  const [picking, setPicking] = useState<string[] | null>(null); // item ids the tag picker is open for
  const [listing, setListing] = useState<{ ids: string[]; lists: List[]; on: Set<string> } | null>(null); // the a picker
  const mounted = useNow();
  const [ticked, setNow] = useState<Date | null>(null);
  const now = ticked ?? mounted;
  const [everPlucked, setEverPlucked] = useState(initial.items.length > 0);
  const [toast, showToast] = useToast();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deletedId) return;
    router.replace(`/${view}`, { scroll: false });
    showToast({
      message: t("deleted"),
      undo: () => void fetch(`/api/v1/items/${deletedId}/restore`, { method: "POST" }).then(() => router.refresh()),
    });
  }, [deletedId, showToast, router, view]);

  const query = useCallback(
    async (f: KindFilter, s: Sort, after?: string, tag: Tag | null = tagFilter) => {
      const kinds = kindsFor(f);
      const qs = new URLSearchParams({
        status: view, sort: s, ...(kinds ? { kinds: kinds.join(",") } : {}), ...(after ? { cursor: after } : {}), ...(tag ? { tagId: tag.id } : {}),
      });
      const res = await fetch(`/api/v1/items?${qs}`);
      return res.ok ? ((await res.json()) as ItemPage) : null;
    },
    [view, tagFilter],
  );

  async function reload(f = filter, s = sort, tag = tagFilter) {
    const page = await query(f, s, undefined, tag);
    if (!page) return;
    setRows(page.items);
    setNextCursor(page.nextCursor);
    setCursor(0);
  }

  // Fresh plucks: poll until the title and cover arrive.
  useEffect(() => {
    const id = setInterval(async () => {
      const t = Date.now();
      setNow(new Date(t));
      if (!rows.some((r) => settling(r, t))) return;
      // One request for the newest page, not one per row: fifty links pasted at once would otherwise spend the
      // person's whole read allowance in seconds. Fresh plucks are the newest, so they are on it.
      const page = await query("all", "newest", undefined, null);
      if (!page) return;
      const fresh = new Map(page.items.map((i) => [i.id, i]));
      setRows((cur) => cur.map((r) => (settling(r, t) && fresh.get(r.id)) || r));
    }, 1500);
    return () => clearInterval(id);
  }, [rows, query]);

  const real = useMemo(() => rows.filter((r) => !r.draft), [rows]);

  // Moves slide the rows out, then call the API; a failure puts them back.
  const move = useCallback(
    async (ids: string[], status: Status) => {
      const moved = real.filter((r) => ids.includes(r.id) && (status !== "done" || r.kind === "todo" || r.kind === "thing"));
      if (!moved.length) return;
      const movedIds = moved.map((r) => r.id);
      setLeaving(new Set(movedIds));
      setSelected(new Set());
      setTimeout(() => {
        setRows((cur) => cur.filter((r) => !movedIds.includes(r.id)));
        setLeaving(new Set());
        setCursor((c) => Math.max(0, Math.min(c, rows.length - movedIds.length - 1)));
      }, SLIDE_MS);
      setTotal((t) => t - moved.length);
      if (!(await moveItems(movedIds, status))) {
        setRows((cur) => [...moved, ...cur]);
        setTotal((t) => t + moved.length);
        return showToast({ message: t("moveFailed") });
      }
      showToast({
        message: moved.length > 1 ? app(`movedMany.${status}`, { count: moved.length }) : app(`moved.${status}`),
        undo: () => {
          void restoreStatuses(moved).then(() => reload());
          setTotal((t) => t + moved.length);
        },
      });
    },
    // reload is read at undo time, so it sees the filter and sort then.
    [real, rows.length, showToast, app],
  );

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const laterTarget: Status = view === "later" ? "inbox" : "later";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const current = real[cursor];
      const targets = selected.size ? [...selected] : current ? [current.id] : [];
      const keys: Record<string, () => void> = {
        j: () => setCursor((c) => Math.min(c + 1, real.length - 1)),
        ArrowDown: () => setCursor((c) => Math.min(c + 1, real.length - 1)),
        k: () => setCursor((c) => Math.max(c - 1, 0)),
        ArrowUp: () => setCursor((c) => Math.max(c - 1, 0)),
        o: () => current && router.push(`/items/${current.id}`),
        Enter: () => current && router.push(`/items/${current.id}`),
        l: () => void move(targets, laterTarget),
        e: () => void move(targets, "archived"),
        d: () => void move(targets, "done"),
        x: () => current && toggle(current.id),
        t: () => targets.length && setPicking(targets),
        a: () => targets.length && void openLists(targets),
        Escape: () => setSelected(new Set()),
        c: () => document.getElementById("pluck-box")?.focus(),
        "/": () => router.push("/search"),
        "?": () => setHelp(true),
      };
      const run = keys[e.key];
      if (!run) return;
      e.preventDefault();
      run();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [real, cursor, selected, move, router, laterTarget]);

  const byId = useMemo(() => new Map(vocab.map((t) => [t.id, t])), [vocab]);
  function chips(r: Row) {
    if (!r.tagIds.length) return null;
    return r.tagIds.map((id) => {
      const tag = byId.get(id);
      return tag ? <TagChip key={id} tag={tag} ai={r.aiTagIds.includes(id)} onClick={() => filterByTag(tag)} label={t("showOnly", { name: tag.name })} /> : null;
    });
  }
  async function filterByTag(t: Tag | null) {
    setTagFilter(t);
    await reload(filter, sort, t);
  }
  async function toggleTag(tag: Tag, on: boolean) {
    const ids = picking ?? [];
    const updated = await setTagOn(ids, tag, on, real);
    if (updated) setRows((cur) => cur.map((r) => updated.find((u) => u.id === r.id) ?? r));
    setVocab(await fetchTags());
  }
  // For one item the picker shows the lists it is already in; for many it starts empty and adds to all.
  async function openLists(ids: string[]) {
    const [lists, memberships] = await Promise.all([fetchLists(), ids.length === 1 ? membershipsOf(ids[0]!) : Promise.resolve([])]);
    setListing({ ids, lists, on: new Set(memberships.map((m) => m.list.id)) });
  }
  async function toggleList(list: List, on: boolean) {
    const ids = listing?.ids;
    if (!ids || !(await setInList(ids, list, on))) return showToast({ message: app("common.didNotGoThrough") });
    const lists = await fetchLists();
    // Only refresh the picker this toggle came from: one closed (Esc) or reopened for other items stays as it is.
    setListing((cur) => {
      if (!cur || cur.ids !== ids) return cur;
      const next = new Set(cur.on);
      if (on) next.add(list.id);
      else next.delete(list.id);
      return { ...cur, on: next, lists };
    });
    showToast({ message: on ? t("addedTo", { name: list.name }) : t("takenOut", { name: list.name }) });
  }
  // The quiet "30 days" pill: in scope, not in a list, and within a week of moving to the Archive.
  const expiring = (r: Row) => {
    if (!expiry.days || r.draft || r.inList || (view === "later" && expiry.scope === "inbox")) return false;
    const left = expiry.days * 86_400_000 - (Date.now() - new Date(r.lastTouchedAt).getTime());
    return left < 7 * 86_400_000;
  };
  async function keep(r: Row) {
    if (!(await fetch(`/api/v1/items/${r.id}/open`, { method: "POST" })).ok) return;
    setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, lastTouchedAt: new Date().toISOString() } : x)));
    showToast({ message: t("kept", { days: expiry.days ?? 0 }) });
  }
  const pickState = (tagId: string) => {
    const targets = real.filter((r) => picking?.includes(r.id));
    const n = targets.filter((r) => r.tagIds.includes(tagId)).length;
    return n === 0 ? "off" : n === targets.length ? "on" : "some";
  };

  // Keep the cursor row in view.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  async function changeFilter(next: KindFilter) {
    setFilter(next);
    await reload(next, sort);
  }
  async function changeSort(next: Sort) {
    setSort(next);
    await reload(filter, next);
  }
  async function more() {
    if (!nextCursor) return;
    const page = await query(filter, sort, nextCursor);
    if (!page) return;
    setRows((cur) => [...cur, ...page.items]);
    setNextCursor(page.nextCursor);
  }

  const onPluck = (d: PluckDraft) => {
    setEverPlucked(true);
    const drafts = placeholders(d);
    if (view !== "inbox") return showToast({ message: d.urls.length > 1 ? t("pluckedMany", { count: d.urls.length }) : app("common.pluckedToInbox") });
    if (drafts.some((r) => !matches(filter, r.kind))) void changeFilter("all");
    setRows((cur) => [...drafts, ...cur]);
  };
  // A re-pluck returns an existing item: it moves to the top instead of appearing twice.
  const onPlucked = (d: PluckDraft, { results }: PluckResponse) => {
    if (view !== "inbox") return;
    const ids = new Set(results.map((r) => r.item.id));
    setTotal((t) => t + results.filter((r) => r.created).length);
    setRows((cur) => [...results.map((r) => r.item), ...cur.filter((r) => r.draft !== d.key && !ids.has(r.id))]);
  };
  const onFailed = (d: PluckDraft) => setRows((cur) => cur.filter((r) => r.draft !== d.key));

  const emptyNode = !everPlucked && rows.length === 0 ? empty() : null;
  const selecting = selected.size > 0;
  const selectedRows = real.filter((r) => selected.has(r.id));
  const allTodo = selectedRows.length > 0 && selectedRows.every((r) => r.kind === "todo" || r.kind === "thing");

  return (
    <>
      <TopBar sample={emptyNode ? sample : undefined} emphasis={Boolean(emptyNode) && view === "inbox"} onPluck={onPluck} onPlucked={onPlucked} onFailed={onFailed} />
      {emptyNode ?? (
        <div className={styles.page}>
          <div className={styles.head}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.headRight}>
              <span className={styles.subtitle}>
                {view === "inbox" ? t("inbox.subtitle", { count: total, sort }) : expiringThisWeek ? t("later.expiring", { count: expiringThisWeek }) : t("later.subtitle")}
              </span>
              <div role="radiogroup" aria-label={t("sort.label")} className={styles.sort}>
                {(["newest", "untouched"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={sort === s} className={styles.sortOption} onClick={() => changeSort(s)}>
                    {t(`sort.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.filters}>
            <KindChips value={filter} onChange={changeFilter} />
            {tagFilter && (
              <button type="button" className={styles.tagFilter} onClick={() => filterByTag(null)} aria-label={t("stopFilter", { name: tagFilter.name })}>
                {tagFilter.name} <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          {selecting && (
            <div role="toolbar" aria-label={t("bulk.label")} className={styles.bulk}>
              <b className={styles.bulkCount}>{t("bulk.selected", { count: selected.size })}</b>
              <button type="button" className={styles.bulkButton} onClick={() => move([...selected], laterTarget)}>
                {view === "later" ? t("actions.inbox") : t("actions.later")}
              </button>
              <button type="button" className={styles.bulkButton} onClick={() => move([...selected], "archived")}>{t("actions.archive")}</button>
              {allTodo && <button type="button" className={styles.bulkButton} onClick={() => move([...selected], "done")}>{t("actions.done")}</button>}
              <button type="button" className={styles.bulkButton} onClick={() => setPicking([...selected])}>{t("actions.tag")}</button>
              <button type="button" className={styles.bulkButton} onClick={() => openLists([...selected])}>{t("bulk.addToList")}</button>
              <button type="button" className={styles.bulkClear} onClick={() => setSelected(new Set())}>{t("bulk.clear")}</button>
            </div>
          )}
          <div ref={listRef} className={styles.rows} aria-label={t("rowsLabel", { view })} role="list">
            {rows.map((r) => {
              const index = real.indexOf(r);
              const active = !r.draft && index === cursor;
              return (
                <div role="listitem" key={r.id}>
                  <ItemRow
                    item={r}
                    now={now}
                    active={active}
                    selecting={selecting && !r.draft}
                    selected={selected.has(r.id)}
                    leaving={leaving.has(r.id)}
                    landing={r.draft ? "draft" : Date.now() - new Date(r.createdAt).getTime() < LANDING_MS ? "fresh" : undefined}
                    onToggle={() => toggle(r.id)}
                    onPoint={() => index >= 0 && setCursor(index)}
                    tags={chips(r)}
                    pill={
                      expiring(r) ? (
                        <button
                          type="button"
                          className={styles.pill}
                          title={t("pill.title", { days: expiry.days ?? 0 })}
                          aria-label={t("pill.label", { title: r.title })}
                          onClick={() => keep(r)}
                        >
                          {t("pill.days", { days: expiry.days ?? 0 })}
                        </button>
                      ) : null
                    }
                    actions={
                      r.draft || selecting ? null : (
                        <>
                          <RowAction label={view === "later" ? t("actions.inbox") : t("actions.later")} keyHint="l" onClick={() => move([r.id], laterTarget)} />
                          <RowAction label={t("actions.archive")} keyHint="e" onClick={() => move([r.id], "archived")} />
                          <RowAction label={t("actions.tag")} keyHint="t" onClick={() => setPicking([r.id])} />
                          <RowAction label={t("actions.list")} keyHint="a" onClick={() => openLists([r.id])} />
                          {(r.kind === "todo" || r.kind === "thing") && <RowAction label={t("actions.done")} keyHint="d" onClick={() => move([r.id], "done")} />}
                          <RowAction label={t("actions.open")} keyHint="o" href={`/items/${r.id}`} />
                        </>
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          {rows.length === 0 && <p className={styles.none}>{filter === "all" ? t("none.all", { view }) : t("none.kind", { view })}</p>}
          {nextCursor && (
            <button type="button" className={styles.more} onClick={more}>
              {app("common.showMore")}
            </button>
          )}
          <div className={styles.keys} aria-hidden="true">
            <span><kbd>j</kbd> <kbd>k</kbd> {t("keys.move")}</span>
            <span><kbd>l</kbd> {view === "later" ? t("keys.inbox") : t("keys.later")}</span>
            <span><kbd>e</kbd> {t("keys.archive")}</span>
            <span><kbd>t</kbd> {t("keys.tag")}</span>
            <span><kbd>a</kbd> {t("keys.list")}</span>
            <span><kbd>x</kbd> {t("keys.select")}</span>
            <span><kbd>?</kbd> {t("keys.help")}</span>
          </div>
        </div>
      )}
      <Shortcuts open={help} onClose={() => setHelp(false)} />
      {listing && (
        <ListPicker
          title={listing.ids.length > 1 ? t("listPicker", { count: listing.ids.length }) : app("itemLists.add")}
          lists={listing.lists}
          state={(id) => (listing.on.has(id) ? "on" : "off")}
          onToggle={toggleList}
          onCreate={createListNamed}
          onClose={() => setListing(null)}
        />
      )}
      {picking && (
        <TagPicker
          title={picking.length > 1 ? t("tagPicker", { count: picking.length }) : app("itemTags.pickerTitle")}
          vocabulary={vocab}
          state={pickState}
          onToggle={toggleTag}
          onCreate={async (name) => {
            const t = await createTagNamed(name);
            if (t) setVocab((v) => [...v.filter((x) => x.id !== t.id), t]);
            return t;
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {toast}
    </>
  );
}
