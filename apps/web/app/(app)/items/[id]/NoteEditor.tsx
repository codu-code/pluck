"use client";

import { plainLine, type Item, type ListMembership, type Tag, type TextKind } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { DeleteButton, ItemBar } from "@/components/ItemBar";
import { ItemLists } from "@/components/ItemLists";
import { ItemTags } from "@/components/ItemTags";
import { useFormat } from "@/components/useFormat";
import { library } from "@/lib/actions";
import styles from "./note.module.css";

// The rich editor reads the page's own selection and parses with WebAssembly: it is made in the browser only, and
// its code comes with the first Note opened, not with the Inbox.
const RichBody = dynamic(() => import("./RichBody"), { ssr: false, loading: () => <div className={styles.rich} aria-busy="true" /> });

type Patch = { title?: string; text?: string; kind?: TextKind; dueAt?: string | null };

// The Note, Todo and Thing editor (ItemNote board). Rich text kept as Markdown, saved as you type; a Note the rich
// editor cannot keep exactly (RichBody) is edited as plain text. Esc goes back.
export function NoteEditor({ item, text, tags, lists }: { item: Item; text: string; tags: Tag[]; lists: ListMembership[] }) {
  const [title, setTitle] = useState(item.titleIsDerived ? "" : item.title);
  const [body, setBody] = useState(text);
  const [kind, setKind] = useState(item.kind as TextKind);
  const [due, setDue] = useState(item.dueAt ? item.dueAt.slice(0, 10) : "");
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [plain, setPlain] = useState(false);
  const [edited, setEdited] = useState(item.updatedAt);
  const [kept, setKept] = useState(item); // as last saved: a #tag in the words is on it
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
    const saved = await library.edit(item.id, patch).catch(() => null);
    if (!saved) {
      pending.current = { ...patch, ...pending.current };
      return setState("error");
    }
    setEdited(saved.updatedAt);
    setKept(saved);
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

  const derived = body.split("\n").map(plainLine).find(Boolean) ?? t("untitled");

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
          {plain ? (
            <label className={styles.field}>
              <span className={styles.visuallyHidden}>{t("body")}</span>
              <textarea
                className={styles.body}
                rows={16}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  save({ text: e.target.value });
                }}
              />
            </label>
          ) : (
            <RichBody
              text={text}
              label={t("body")}
              autoFocus={!text}
              onChange={(md) => {
                setBody(md);
                save({ text: md });
              }}
              onUnfit={() => setPlain(true)}
            />
          )}
          <span className={styles.meta}>{t(plain ? "helpPlain" : "help")}</span>
        </article>
        <aside aria-label={t("about", { kind })} className={styles.aside}>
          <ItemTags item={kept} vocabulary={tags} />
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
