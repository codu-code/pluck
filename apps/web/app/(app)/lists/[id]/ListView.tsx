"use client";

import type { List, ListEntry } from "@pluck/shared-schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import { rowSite } from "@/lib/format";
import { isTyping } from "@/lib/keys";
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

// The Collection board: one list in order, each item with a tick and a note that belong to the list.
export function ListView({ initial, handle }: { initial: { list: List; entries: ListEntry[] }; handle: string | null }) {
  const router = useRouter();
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
  const dragRef = useRef<string | null>(null); // for the logic: set synchronously, before the first dragover
  const [host, setHost] = useState("getpluck.io");
  useEffect(() => setHost(window.location.host), []);
  const [toast, showToast] = useToast();
  const listRef = useRef<HTMLOListElement>(null);
  const base = `/api/v1/lists/${list.id}`;
  const ticked = entries.filter((e) => e.ticked).length;

  async function tick(e: ListEntry) {
    setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? { ...x, ticked: !x.ticked } : x)));
    if (!(await send(`${base}/items/${e.item.id}`, "PATCH", { ticked: !e.ticked })).ok) {
      setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? e : x)));
      showToast({ message: "That did not go through." });
    }
  }

  async function saveNote(e: ListEntry) {
    setNoting(null);
    if ((e.note ?? "") === draft.trim()) return;
    setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? { ...x, note: draft.trim() || null, noteBy: draft.trim() ? "user" : null } : x)));
    const res = await send(`${base}/items/${e.item.id}`, "PATCH", { note: draft.trim() || null });
    if (res.ok) return;
    setEntries((cur) => cur.map((x) => (x.item.id === e.item.id ? e : x))); // back to what is saved
    showToast({ message: "That did not go through." });
  }

  // Moves entry `id` to index `to` and writes its new position.
  async function moveTo(id: string, to: number) {
    const from = entries.findIndex((e) => e.item.id === id);
    if (from < 0 || to < 0 || to >= entries.length || from === to) return;
    const rest = entries.filter((e) => e.item.id !== id);
    const position = between(rest[to - 1]?.position, rest[to]?.position);
    const moved = { ...entries[from]!, position };
    const next = [...rest.slice(0, to), moved, ...rest.slice(to)];
    setEntries(next);
    setCursor(to);
    if (!(await send(`${base}/items/${id}`, "PATCH", { position })).ok) {
      setEntries(entries);
      showToast({ message: "That did not go through." });
    }
  }

  async function remove(e: ListEntry) {
    setEntries((cur) => cur.filter((x) => x.item.id !== e.item.id));
    await send(`${base}/items/${e.item.id}`, "DELETE");
    showToast({
      message: `Taken out of “${list.name}”. It is still in your library.`,
      undo: () => void send(`${base}/items`, "POST", { itemId: e.item.id, position: e.position, note: e.note }).then(() => router.refresh()),
    });
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || isTyping(ev.target) || noting) return;
      const current = entries[cursor];
      const run: (() => void) | undefined = {
        j: () => setCursor((c) => Math.min(c + 1, entries.length - 1)),
        ArrowDown: () => setCursor((c) => Math.min(c + 1, entries.length - 1)),
        k: () => setCursor((c) => Math.max(c - 1, 0)),
        ArrowUp: () => setCursor((c) => Math.max(c - 1, 0)),
        J: () => current && void moveTo(current.item.id, cursor + 1),
        K: () => current && void moveTo(current.item.id, cursor - 1),
        " ": () => current && void tick(current),
        n: () => current && (setNoting(current.item.id), setDraft(current.note ?? "")),
        o: () => current && router.push(`/items/${current.item.id}`),
        Enter: () => current && router.push(`/items/${current.item.id}`),
        Escape: () => router.push("/lists"),
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
      return showToast({ message: visibility === "public" ? "Public. Anyone with the link can see it." : "Private again. The link stops working now." });
    }
    showToast({ message: body?.error?.message ?? "That did not go through." });
  }

  async function saveMeta(patch: { name?: string; purpose?: string }) {
    const res = await send(base, "PATCH", patch);
    if (res.ok) setList(((await res.json()) as { list: List }).list);
  }

  async function exportMarkdown() {
    const res = await fetch(`${base}/export?format=md`);
    if (!res.ok) return showToast({ message: "That did not go through." });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const askPrompt = `Read my Pluck list "${list.name}" and tell me what it covers, what is missing, and the best order to read it in.`;

  return (
    <>
      <TopBar onPluck={() => showToast({ message: "Plucked to the Inbox." })} />
      <div className={styles.page}>
        <Link href="/lists" className={styles.crumb}>Lists</Link>
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
                <input className={styles.nameInput} aria-label="List name" maxLength={120} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
                <button type="submit" className={styles.secondary}>Save</button>
              </form>
            ) : (
              <h1 className={styles.title}>
                {list.name}{" "}
                <button type="button" className={styles.renameButton} onClick={() => setRenaming(true)}>Rename</button>
              </h1>
            )}
            <label className={styles.purpose}>
              <span className={styles.meta}>Purpose</span>
              <input
                className={styles.input}
                value={purpose}
                placeholder="One line on what this list is for"
                onChange={(e) => setPurpose(e.target.value)}
                onBlur={() => purpose !== list.purpose && void saveMeta({ purpose })}
              />
            </label>
          </div>
          <div className={styles.visibility}>
            <div role="radiogroup" aria-label="Visibility" className={styles.switch}>
              {(["private", "public"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={list.visibility === v} className={styles.switchOption} onClick={() => list.visibility !== v && setVisibility(v)}>
                  {v === "private" ? "Private" : "Public"}
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
                      showToast({ message: "Link copied." });
                    }}
                  >
                    Copy
                  </button>
                </span>
                <span className={styles.meta}>
                  {list.views} view{list.views === 1 ? "" : "s"} · only you see this · <a href={`/@${handle}/${list.slug}`} target="_blank" rel="noreferrer">View the public page</a>
                </span>
              </>
            ) : (
              <span className={styles.meta}>Only you can see this list.</span>
            )}
          </div>
        </div>

        <div className={styles.tools}>
          <button
            type="button"
            className={styles.secondary}
            onClick={async () => {
              await navigator.clipboard?.writeText(askPrompt).catch(() => {});
              showToast({ message: "Copied. Paste it into your AI." });
            }}
          >
            Copy for your AI: “Ask about this list”
          </button>
          <button type="button" className={styles.secondary} onClick={exportMarkdown}>Export this list</button>
          <span className={styles.count}>{ticked} of {entries.length} ticked</span>
        </div>

        {entries.length === 0 ? (
          <p className={styles.meta}>Nothing here yet. Press a on any item in the Inbox to add it.</p>
        ) : (
          <ol ref={listRef} className={styles.rows} aria-label={`${list.name}, in order`}>
            {entries.map((e, i) => (
              <li
                key={e.item.id}
                className={styles.row}
                data-active={i === cursor || undefined}
                data-dragging={dragging === e.item.id || undefined}
                onMouseMove={() => setCursor(i)}
                onDragOver={(ev) => dragRef.current && ev.preventDefault()}
                onDrop={(ev) => {
                  ev.preventDefault();
                  if (dragRef.current) void moveTo(dragRef.current, i);
                  dragRef.current = null;
                  setDragging(null);
                }}
              >
                <button
                  type="button"
                  className={styles.handle}
                  aria-label={`Drag to reorder ${e.item.title}. Or Shift+J and Shift+K.`}
                  draggable
                  onDragStart={(ev) => {
                    dragRef.current = e.item.id;
                    setDragging(e.item.id);
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData("text/plain", e.item.title);
                  }}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setDragging(null);
                  }}
                >
                  <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
                    <path d="M4 4h.01M8 4h.01M4 8h.01M8 8h.01M4 12h.01M8 12h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
                <span className={styles.n}>{i + 1}</span>
                <input type="checkbox" className={styles.tick} checked={e.ticked} onChange={() => tick(e)} aria-label={`Tick ${e.item.title}`} />
                <div className={styles.body}>
                  <div className={styles.titleLine}>
                    <Link href={`/items/${e.item.id}`} className={styles.itemTitle} data-ticked={e.ticked || undefined}>{e.item.title}</Link>
                    <span className={styles.meta}>{rowSite(e.item)}</span>
                  </div>
                  {noting === e.item.id ? (
                    <form
                      className={styles.noteForm}
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        void saveNote(e);
                      }}
                      onKeyDown={(ev) => ev.key === "Escape" && (ev.stopPropagation(), setNoting(null))}
                    >
                      <input className={styles.input} aria-label={`Note on ${e.item.title} in this list`} value={draft} maxLength={2000} autoFocus onChange={(ev) => setDraft(ev.target.value)} onBlur={() => saveNote(e)} />
                    </form>
                  ) : e.note ? (
                    <span className={e.noteBy === "mcp" ? `${styles.note} ${styles.ai}` : styles.note}>
                      {e.noteBy === "mcp" && <span aria-hidden="true" className={styles.dot} />}
                      <span>
                        {e.note}
                        {e.noteBy === "mcp" && <span className={styles.byAi}> · by AI</span>}
                      </span>
                    </span>
                  ) : null}
                </div>
                {i === cursor && noting !== e.item.id && (
                  <span className={styles.rowActions}>
                    <button type="button" className={styles.small} onClick={() => (setNoting(e.item.id), setDraft(e.note ?? ""))}>
                      Note <kbd className={styles.kbd}>n</kbd>
                    </button>
                    <button type="button" className={styles.small} onClick={() => remove(e)}>Take out</button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className={styles.keys} aria-hidden="true">
          <span><kbd>Space</kbd> tick</span>
          <span><kbd>n</kbd> note</span>
          <span><kbd>Shift+J</kbd> <kbd>Shift+K</kbd> reorder</span>
          <span>Add from the inbox with <kbd>a</kbd>, or pluck straight in from the extension</span>
        </div>
        <div className={styles.danger}>
          {confirmDelete ? (
            <span className={styles.inline}>
              Delete “{list.name}”? Its items stay in your library.
              <button
                type="button"
                className={styles.small}
                onClick={async () => {
                  if ((await send(base, "DELETE")).ok) router.push("/lists");
                }}
              >
                Yes, delete the list
              </button>
              <button type="button" className={styles.small} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className={styles.deleteLink} onClick={() => setConfirmDelete(true)}>Delete this list</button>
          )}
        </div>
      </div>
      {toast}
    </>
  );
}
