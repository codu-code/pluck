"use client";

import { listMarkWord, markWord, type List, type ListEntry, type ListShare } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FoldHeader, useFolded } from "@/components/Fold";
import { ItemRow, RowAction, RowLead, RowMark, RowNote } from "@/components/ItemRow";
import { useToast } from "@/components/Toast";
import { People } from "./People";
import { TopBar } from "@/components/TopBar";
import { isTyping } from "@/lib/keys";
import { useNow } from "@/lib/use-now";
import styles from "./list.module.css";

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

// A float between the neighbours: one write per move. The server renumbers if they ever get too close.
function between(prev: number | undefined, next: number | undefined): number {
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1024;
  if (next !== undefined) return next / 2;
  return 1024;
}

const byPosition = (a: ListEntry, b: ListEntry) => a.position - b.position;

// The Collection board, with Inbox rows: one list in order, each item with a note and a mark that belong to the list.
// Marked rows gather under a header that folds; each keeps its number.
export function ListView({ initial, handle, host, people }: { initial: { list: List; entries: ListEntry[] }; handle: string | null; host: string; people: ListShare[] }) {
  const router = useRouter();
  const now = useNow();
  const [list, setList] = useState(initial.list);
  const [entries, setEntries] = useState(initial.entries);
  const [cursor, setCursor] = useState(0);
  const [noting, setNoting] = useState<string | null>(null); // item id whose note is being edited
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(initial.list.name);
  const [purpose, setPurpose] = useState(initial.list.purpose);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null); // for the look
  const dragRef = useRef<ListEntry | null>(null); // for the logic: set synchronously, before the first dragover
  const [picking, setPicking] = useState(false); // Select pressed, nothing chosen yet
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, showToast] = useToast();
  const t = useTranslations("app.list");
  const app = useTranslations("app");
  const listRef = useRef<HTMLDivElement>(null);
  const base = `/api/v1/lists/${list.id}`;
  const [folded, toggleFold] = useFolded(`list:${list.id}:marked`);

  const word = listMarkWord(entries.map((e) => e.item.kind));
  const open = entries.filter((e) => !e.ticked);
  const marked = entries.filter((e) => e.ticked);
  const shown = folded ? open : [...open, ...marked];
  const number = new Map(entries.map((e, i) => [e.item.id, i + 1]));
  const selecting = picking || selected.size > 0;
  const chosen = entries.filter((e) => selected.has(e.item.id));
  const bulkWord = listMarkWord(chosen.map((e) => e.item.kind));

  const fail = (back: ListEntry[]) => {
    setEntries(back);
    showToast({ message: app("common.didNotGoThrough") });
  };

  // Marks one or many. A Todo or Thing is Done when marked (the server keeps the two in step).
  async function mark(ids: string[], ticked: boolean) {
    const back = entries;
    setEntries((cur) => cur.map((x) => (ids.includes(x.item.id) ? { ...x, ticked } : x)));
    const res = ids.length === 1 ? await send(`${base}/items/${ids[0]}`, "PATCH", { ticked }) : await send(`${base}/items`, "PATCH", { itemIds: ids, ticked });
    if (!res.ok) fail(back);
  }

  async function saveNote(e: ListEntry) {
    setNoting(null);
    if ((e.note ?? "") === draft.trim()) return;
    setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? { ...x, note: draft.trim() || null, noteBy: draft.trim() ? "user" : null } : x)));
    const res = await send(`${base}/items/${e.item.id}`, "PATCH", { note: draft.trim() || null });
    if (!res.ok) fail(entries);
  }

  // Moves an entry to index `to` within its group (open or marked) and writes its new position.
  async function moveTo(e: ListEntry, to: number) {
    const group = (e.ticked ? marked : open);
    const from = group.findIndex((x) => x.item.id === e.item.id);
    if (from < 0 || to < 0 || to >= group.length || from === to) return;
    const rest = group.filter((x) => x.item.id !== e.item.id);
    const position = between(rest[to - 1]?.position, rest[to]?.position);
    const back = entries;
    setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? { ...x, position } : x)).sort(byPosition));
    setCursor(shown.indexOf(e) + (to - from));
    if (!(await send(`${base}/items/${e.item.id}`, "PATCH", { position })).ok) fail(back);
  }

  async function toTop(ids: string[]) {
    const order = [...entries.filter((e) => ids.includes(e.item.id)), ...entries.filter((e) => !ids.includes(e.item.id))];
    const back = entries;
    setEntries(order.map((e, i) => ({ ...e, position: (i + 1) * 1024 })));
    if (!(await send(`${base}/reorder`, "POST", { itemIds: order.map((e) => e.item.id) })).ok) fail(back);
  }

  async function remove(gone: ListEntry[]) {
    const ids = gone.map((e) => e.item.id);
    setEntries((cur) => cur.filter((x) => !ids.includes(x.item.id)));
    for (const id of ids) await send(`${base}/items/${id}`, "DELETE");
    showToast({
      message: gone.length === 1 ? t("takenOut", { name: list.name }) : t("takenOutMany", { count: gone.length, name: list.name }),
      undo: async () => {
        for (const e of gone) await send(`${base}/items`, "POST", { itemId: e.item.id, position: e.position, note: e.note });
        if (gone.some((e) => e.ticked)) await send(`${base}/items`, "PATCH", { itemIds: gone.filter((e) => e.ticked).map((e) => e.item.id), ticked: true });
        router.refresh();
      },
    });
  }

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const endSelect = () => (setSelected(new Set()), setPicking(false));
  const bulk = async (run: () => Promise<void>) => {
    endSelect();
    await run();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || isTyping(ev.target) || noting) return;
      const current = shown[cursor];
      const group = current && (current.ticked ? marked : open);
      const at = current && group ? group.indexOf(current) : -1;
      const run: (() => void) | undefined = {
        j: () => setCursor((c) => Math.min(c + 1, shown.length - 1)),
        ArrowDown: () => setCursor((c) => Math.min(c + 1, shown.length - 1)),
        k: () => setCursor((c) => Math.max(c - 1, 0)),
        ArrowUp: () => setCursor((c) => Math.max(c - 1, 0)),
        J: () => current && void moveTo(current, at + 1),
        K: () => current && void moveTo(current, at - 1),
        " ": () => current && void mark([current.item.id], !current.ticked),
        x: () => current && toggle(current.item.id),
        n: () => current && (setNoting(current.item.id), setDraft(current.note ?? "")),
        o: () => current && router.push(`/items/${current.item.id}`),
        Enter: () => current && router.push(`/items/${current.item.id}`),
        Escape: () => (selecting ? endSelect() : router.push("/lists")),
      }[ev.key];
      if (!run) return;
      ev.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    listRef.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Flow 15: one switch, then the link. Everyone has a handle (a made-up one until they choose).
  async function setVisibility(visibility: "private" | "public") {
    const res = await send(base, "PATCH", { visibility });
    const body = await res.json();
    if (res.ok) {
      setList((body as { list: List }).list);
      return showToast({ message: visibility === "public" ? t("nowPublic") : t("nowPrivate") });
    }
    showToast({ message: body?.error?.message ?? app("common.didNotGoThrough") });
  }

  async function saveMeta(patch: { name?: string; purpose?: string }) {
    const res = await send(base, "PATCH", patch);
    if (res.ok) setList(((await res.json()) as { list: List }).list);
  }

  async function exportMarkdown() {
    const res = await fetch(`${base}/export?format=md`);
    if (!res.ok) return showToast({ message: app("common.didNotGoThrough") });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const askPrompt = t("askPrompt", { name: list.name });

  const row = (e: ListEntry) => {
    const i = shown.indexOf(e);
    const w = markWord(e.item.kind);
    return (
      <li
        key={e.item.id}
        className={styles.item}
        data-dragging={dragging === e.item.id || undefined}
        onDragOver={(ev) => dragRef.current && dragRef.current.ticked === e.ticked && ev.preventDefault()}
        onDrop={(ev) => {
          ev.preventDefault();
          const moving = dragRef.current;
          if (moving && moving.ticked === e.ticked) void moveTo(moving, (e.ticked ? marked : open).indexOf(e));
          dragRef.current = null;
          setDragging(null);
        }}
      >
        <ItemRow
          item={e.item}
          now={now}
          whenIso={null}
          active={i === cursor}
          selecting={selecting}
          selected={selected.has(e.item.id)}
          onToggle={() => toggle(e.item.id)}
          onPoint={() => setCursor(i)}
          marked={e.ticked}
          lead={
            <RowLead
              n={number.get(e.item.id) ?? i + 1}
              handle={{
                "aria-label": t("drag", { title: e.item.title }),
                draggable: true,
                onDragStart: (ev) => {
                  dragRef.current = e;
                  setDragging(e.item.id);
                  ev.dataTransfer.effectAllowed = "move";
                  ev.dataTransfer.setData("text/plain", e.item.title);
                },
                onDragEnd: () => {
                  dragRef.current = null;
                  setDragging(null);
                },
              }}
            />
          }
          below={
            noting === e.item.id ? (
              <form
                className={styles.noteForm}
                onSubmit={(ev) => {
                  ev.preventDefault();
                  void saveNote(e);
                }}
                onKeyDown={(ev) => ev.key === "Escape" && (ev.stopPropagation(), setNoting(null))}
              >
                <input className={styles.noteInput} aria-label={t("noteLabel", { title: e.item.title })} value={draft} maxLength={2000} autoFocus onChange={(ev) => setDraft(ev.target.value)} onBlur={() => saveNote(e)} />
              </form>
            ) : e.note ? (
              <RowNote text={e.note} byAi={e.noteBy === "mcp" ? t("byAi") : undefined} />
            ) : undefined
          }
          actions={
            noting === e.item.id || selecting ? null : (
              <>
                <RowAction label={t("note")} keyHint="n" onClick={() => (setNoting(e.item.id), setDraft(e.note ?? ""))} />
                <RowAction label={t("takeOut")} onClick={() => remove([e])} />
              </>
            )
          }
          trail={<RowMark checked={e.ticked} word={t(`mark.${w}.label`)} a11y={t(`mark.${w}.a11y`, { title: e.item.title })} onChange={() => mark([e.item.id], !e.ticked)} />}
        />
      </li>
    );
  };

  return (
    <>
      <TopBar onPluck={() => showToast({ message: app("common.pluckedToInbox") })} />
      <div className={styles.page}>
        <Link href="/lists" className={styles.crumb}>{t("crumb")}</Link>
        <div className={styles.head}>
          <div className={styles.titleCol}>
            {renaming ? (
              <form
                className={styles.renameForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  setRenaming(false);
                  if (name.trim() && name.trim() !== list.name) void saveMeta({ name: name.trim() });
                }}
                onKeyDown={(e) => e.key === "Escape" && (setRenaming(false), setName(list.name))}
              >
                <input className={styles.nameInput} aria-label={t("nameLabel")} maxLength={120} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
                <button type="submit" className={styles.secondary}>{app("common.save")}</button>
              </form>
            ) : (
              <h1 className={styles.title}>
                {list.name}{" "}
                <button type="button" className={styles.renameButton} onClick={() => setRenaming(true)}>{app("common.rename")}</button>
              </h1>
            )}
            <label className={styles.purpose}>
              <span className={styles.meta}>{t("purpose")}</span>
              <input
                className={styles.input}
                value={purpose}
                placeholder={t("purposePlaceholder")}
                onChange={(e) => setPurpose(e.target.value)}
                onBlur={() => purpose !== list.purpose && void saveMeta({ purpose })}
              />
            </label>
          </div>
          <div className={styles.visibility}>
            <div role="radiogroup" aria-label={t("visibility")} className={styles.switch}>
              {(["private", "public"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={list.visibility === v} className={styles.switchOption} onClick={() => list.visibility !== v && setVisibility(v)}>
                  {t(v)}
                </button>
              ))}
            </div>
            {list.visibility === "public" && handle ? (
              <>
                <span className={styles.linkRow}>
                  <code className={styles.link}>{`${host}/@${handle}/${list.slug}`}</code>
                  <button
                    type="button"
                    className={styles.primarySmall}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(`${window.location.origin}/@${handle}/${list.slug}`).catch(() => {});
                      showToast({ message: t("linkCopied") });
                    }}
                  >
                    {app("common.copy")}
                  </button>
                </span>
                <span className={styles.meta}>
                  {t.rich("views", { count: list.views, a: (c) => <a href={`/@${handle}/${list.slug}`} target="_blank" rel="noreferrer">{c}</a> })}
                </span>
              </>
            ) : (
              <span className={styles.meta}>{people.length ? t("privateShared") : t("privateOnly")}</span>
            )}
            <People listId={list.id} initial={people} say={(message) => showToast({ message })} />
          </div>
        </div>

        {selecting ? (
          <div role="toolbar" aria-label={app("itemList.bulk.label")} className={styles.bulk}>
            <b className={styles.bulkCount}>{app("itemList.bulk.selected", { count: selected.size })}</b>
            {chosen.length > 0 && (
              <>
                <button type="button" className={styles.bulkButton} onClick={() => bulk(() => mark(chosen.map((e) => e.item.id), true))}>{t(`mark.${bulkWord}.bulk`)}</button>
                <button type="button" className={styles.bulkButton} onClick={() => bulk(() => mark(chosen.map((e) => e.item.id), false))}>{t("unmark")}</button>
                <button type="button" className={styles.bulkButton} onClick={() => bulk(() => toTop(chosen.map((e) => e.item.id)))}>{t("toTop")}</button>
                <button type="button" className={styles.bulkButton} onClick={() => bulk(() => remove(chosen))}>{t("takeOut")}</button>
              </>
            )}
            <button type="button" className={styles.bulkClear} onClick={endSelect}>{app("itemList.bulk.clear")}</button>
          </div>
        ) : (
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.secondary}
              onClick={async () => {
                await navigator.clipboard?.writeText(askPrompt).catch(() => {});
                showToast({ message: app("common.copiedForAi") });
              }}
            >
              {t("copyAsk")}
            </button>
            <button type="button" className={styles.secondary} onClick={exportMarkdown}>{t("export")}</button>
            {entries.length > 0 && <button type="button" className={styles.secondary} onClick={() => setPicking(true)}>{t("select")}</button>}
            {marked.length > 0 && <span className={styles.count}>{t(`mark.${word}.progress`, { ticked: marked.length, count: entries.length })}</span>}
          </div>
        )}

        {entries.length === 0 ? (
          <p className={styles.meta}>{t("empty")}</p>
        ) : (
          <div ref={listRef}>
            <ol className={styles.rows} aria-label={t("rowsLabel", { name: list.name })}>
              {open.map(row)}
            </ol>
            {marked.length > 0 && (
              <>
                <FoldHeader id="marked-rows" label={t(`mark.${word}.label`)} count={marked.length} folded={folded} onToggle={toggleFold} />
                <ol id="marked-rows" className={`${styles.rows} ${styles.underHeader}`} aria-label={t(`mark.${word}.label`)} hidden={folded}>
                  {marked.map(row)}
                </ol>
              </>
            )}
          </div>
        )}
        <div className={styles.keys} aria-hidden="true">
          <span><kbd>Space</kbd> {t("keys.mark")}</span>
          <span><kbd>x</kbd> {t("keys.select")}</span>
          <span><kbd>n</kbd> {t("keys.note")}</span>
          <span><kbd>Shift+J</kbd> <kbd>Shift+K</kbd> {t("keys.reorder")}</span>
          <span>{t.rich("keys.add", { kbd: (c) => <kbd>{c}</kbd> })}</span>
        </div>
        <div className={styles.danger}>
          {confirmDelete ? (
            <span className={styles.inline}>
              {t("delete.confirm", { name: list.name })}
              <button
                type="button"
                className={styles.small}
                onClick={async () => {
                  if ((await send(base, "DELETE")).ok) router.push("/lists");
                }}
              >
                {t("delete.yes")}
              </button>
              <button type="button" className={styles.small} onClick={() => setConfirmDelete(false)}>{app("common.cancel")}</button>
            </span>
          ) : (
            <button type="button" className={styles.deleteLink} onClick={() => setConfirmDelete(true)}>{t("delete.action")}</button>
          )}
        </div>
      </div>
      {toast}
    </>
  );
}
