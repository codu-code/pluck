"use client";

import type { Item, ListMembership, Tag, TextKind } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DeleteButton, ItemBar } from "@/components/ItemBar";
import { ItemLists } from "@/components/ItemLists";
import { ItemTags } from "@/components/ItemTags";
import { useFormat } from "@/components/useFormat";
import styles from "./note.module.css";

type Patch = { title?: string; text?: string; kind?: TextKind; dueAt?: string | null };

// The Note, Todo and Thing editor (ItemNote board). Plain text, saved as you type. Esc goes back.
export function NoteEditor({ item, text, tags, lists }: { item: Item; text: string; tags: Tag[]; lists: ListMembership[] }) {
  const [title, setTitle] = useState(item.titleIsDerived ? "" : item.title);
  const [body, setBody] = useState(text);
  const [kind, setKind] = useState(item.kind as TextKind);
  const [due, setDue] = useState(item.dueAt ? item.dueAt.slice(0, 10) : "");
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [edited, setEdited] = useState(item.updatedAt);
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useTranslations("app.note");
  const app = useTranslations("app");
  const f = useFormat();

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

  // Never lose typing: flush on leave. keepalive lets the PATCH finish after the page is gone.
  useEffect(() => {
    const onLeave = () => {
      clearTimeout(timer.current);
      if (!Object.keys(pending.current).length) return;
      const body = JSON.stringify(pending.current);
      pending.current = {};
      void fetch(`/api/v1/items/${item.id}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body });
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, [item.id]);

  const derived = body.split("\n").map((l) => l.trim()).find(Boolean) ?? t("untitled");

  return (
    <>
      <ItemBar
        item={item}
        before={flush}
        state={<span role="status">{t(`state.${state}`)}</span>}
      />
      <div className={styles.layout}>
        <article className={styles.editor}>
          <span className={styles.meta}>
            {t("meta", { kind: app(`kind.${kind}`), plucked: app(`format.sourceAgo.${item.source}`, { ago: f.ago(item.createdAt) }), edited: f.ago(edited) })}
          </span>
          <label className={styles.field}>
            <span className={styles.visuallyHidden}>{t("title")}</span>
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
            <span className={styles.visuallyHidden}>{t("body")}</span>
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
          <span className={styles.meta}>{t("help")}</span>
        </article>
        <aside aria-label={t("about", { kind })} className={styles.aside}>
          <ItemTags item={item} vocabulary={tags} />
          <label className={styles.group}>
            <span className={styles.groupTitle}>{t("kind")}</span>
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
              <option value="note">{app("kind.note")}</option>
              <option value="todo">{app("kind.todo")}</option>
              <option value="thing">{app("kind.thing")}</option>
            </select>
            <span className={styles.meta}>{t(`kindHint.${kind}`)}</span>
          </label>
          {kind !== "note" && (
            <label className={styles.group}>
              <span className={styles.groupTitle}>{t("due")}</span>
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
          <ItemLists itemId={item.id} initial={lists} />
          <div className={styles.foot}>
            <span>{t("source", { via: item.source === "web" ? t("pasteBox") : app(`format.via.${item.source}`) })}</span>
            <span>{t("noHighlights")}</span>
            <DeleteButton id={item.id} />
          </div>
        </aside>
      </div>
    </>
  );
}
