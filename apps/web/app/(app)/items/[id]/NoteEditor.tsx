"use client";

import type { Item, TextKind } from "@pluck/shared-schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ago, sourceLabel } from "@/lib/format";
import styles from "./note.module.css";

type Patch = { title?: string; text?: string; kind?: TextKind; dueAt?: string | null };

const KIND_HINT: Record<TextKind, string> = {
  note: "Make it a Todo to add a due date and a tick.",
  todo: "A Todo can have a due date. Done moves it out of the Inbox.",
  thing: "A Thing is something to get. Lists are where they gather.",
};

// The Note, Todo and Thing editor (ItemNote board). Plain text, saved as you type. Esc goes back.
export function NoteEditor({ item, text }: { item: Item; text: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.titleIsDerived ? "" : item.title);
  const [body, setBody] = useState(text);
  const [kind, setKind] = useState(item.kind as TextKind);
  const [due, setDue] = useState(item.dueAt ? item.dueAt.slice(0, 10) : "");
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [edited, setEdited] = useState(item.updatedAt);
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function flush() {
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setState("saving");
    const res = await fetch(`/api/v1/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) {
      pending.current = { ...patch, ...pending.current };
      return setState("error");
    }
    setEdited(((await res.json()) as { item: Item }).item.updatedAt);
    setState(Object.keys(pending.current).length ? "saving" : "saved");
  }

  function save(patch: Patch, now = false) {
    pending.current = { ...pending.current, ...patch };
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, now ? 0 : 600);
  }

  // Never lose typing: flush on leave.
  useEffect(() => {
    // keepalive lets the PATCH finish after the page is gone (sendBeacon cannot PATCH).
    const onLeave = () => {
      clearTimeout(timer.current);
      if (!Object.keys(pending.current).length) return;
      const body = JSON.stringify(pending.current);
      pending.current = {};
      void fetch(`/api/v1/items/${item.id}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void flush().then(() => router.push("/inbox"));
      }
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("keydown", onKey);
      onLeave();
    };
  }, [item.id, router]);

  const derived = body.split("\n").map((l) => l.trim()).find(Boolean) ?? "Untitled note";
  const kindName = kind === "note" ? "Note" : kind === "todo" ? "Todo" : "Thing";

  return (
    <>
      <div className={styles.bar}>
        <Link href="/inbox" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Inbox <kbd className={styles.kbd}>Esc</kbd>
        </Link>
        <span className={styles.state} role="status">
          {state === "saved" ? "Saved" : state === "saving" ? "Saving" : "Not saved. Retrying when you type."}
        </span>
      </div>
      <div className={styles.layout}>
        <article className={styles.editor}>
          <span className={styles.meta}>
            {kindName} · {sourceLabel(item.source).toLowerCase()} {ago(item.createdAt)} · edited {ago(edited)}
          </span>
          <label className={styles.field}>
            <span className={styles.visuallyHidden}>Title</span>
            <input
              className={styles.title}
              type="text"
              value={title}
              placeholder={derived}
              onChange={(e) => {
                setTitle(e.target.value);
                save({ title: e.target.value });
              }}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.visuallyHidden}>Body</span>
            <textarea
              className={styles.body}
              rows={16}
              value={body}
              autoFocus={!text}
              onChange={(e) => {
                setBody(e.target.value);
                save({ text: e.target.value });
              }}
            />
          </label>
          <span className={styles.meta}>The first line is the title. Plain text. Saves as you type.</span>
        </article>
        <aside aria-label={`About this ${kindName.toLowerCase()}`} className={styles.aside}>
          <label className={styles.group}>
            <span className={styles.groupTitle}>Kind</span>
            <select
              className={styles.select}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as TextKind;
                setKind(k);
                save({ kind: k, ...(k === "note" && due ? { dueAt: null } : {}) }, true);
                if (k === "note") setDue("");
              }}
            >
              <option value="note">Note</option>
              <option value="todo">Todo</option>
              <option value="thing">Thing</option>
            </select>
            <span className={styles.meta}>{KIND_HINT[kind]}</span>
          </label>
          {kind !== "note" && (
            <label className={styles.group}>
              <span className={styles.groupTitle}>Due</span>
              <input
                className={styles.select}
                type="date"
                value={due}
                onChange={(e) => {
                  setDue(e.target.value);
                  save({ dueAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null }, true);
                }}
              />
            </label>
          )}
          <div className={styles.foot}>
            <span>Source: {item.source === "web" ? "web paste box" : sourceLabel(item.source).replace(/^Plucked /, "")}</span>
            <span>Notes have no highlights. Select text to copy it.</span>
          </div>
        </aside>
      </div>
    </>
  );
}
