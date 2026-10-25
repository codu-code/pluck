"use client";

import type { Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { fetchTags } from "@/lib/tagging";
import styles from "./settings.module.css";

type Mode = { id: string; kind: "rename" | "merge" | "delete" } | null;

// Tags: rename, merge, delete, and "Remove everything AI tagged this week".
export function TagsSection({ initial, aiWeek: initialAi }: { initial: Tag[]; aiWeek: number }) {
  const [tags, setTags] = useState(initial);
  const [aiWeek, setAiWeek] = useState(initialAi);
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [toast, showToast] = useToast();
  const t = useTranslations("app.settings.tags");
  const app = useTranslations("app.common");

  const refresh = async () => setTags(await fetchTags());
  const open = (id: string, kind: "rename" | "merge" | "delete", name = "") => {
    setMode({ id, kind });
    setDraft(name);
    setTarget("");
    setError(null);
  };

  async function rename(tag: Tag) {
    const res = await fetch(`/api/v1/tags/${tag.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft }) });
    if (!res.ok) return setError(((await res.json()) as { error: { message: string } }).error.message);
    setMode(null);
    await refresh();
  }

  async function remove(tag: Tag, into?: Tag) {
    const qs = into ? `reassignTo=${into.id}` : "removeFromItems=true";
    const res = await fetch(`/api/v1/tags/${tag.id}?${qs}`, { method: "DELETE" });
    if (!res.ok) return setError(app("didNotGoThrough"));
    setMode(null);
    await refresh();
    showToast({ message: into ? t("merged", { name: tag.name, into: into.name }) : t("deleted", { name: tag.name }) });
  }

  async function purge() {
    const res = await fetch("/api/v1/tags/purge-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 7 }) });
    setConfirmPurge(false);
    if (!res.ok) return showToast({ message: app("didNotGoThrough") });
    const { assignments } = (await res.json()) as { assignments: number };
    setAiWeek(0);
    await refresh();
    showToast({ message: t("purged", { count: assignments }) });
  }

  return (
    <section id="tags" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>{t("title")}</h2>
        {confirmPurge ? (
          <span className={styles.confirm}>
            {t("purge.confirm", { count: aiWeek })}
            <button type="button" className={styles.clayButton} onClick={purge}>{t("purge.yes")}</button>
            <button type="button" className={styles.textButton} onClick={() => setConfirmPurge(false)}>{app("cancel")}</button>
          </span>
        ) : (
          <button type="button" className={styles.clayButton} disabled={aiWeek === 0} onClick={() => setConfirmPurge(true)}>
            {t("purge.action", { count: aiWeek })}
          </button>
        )}
      </div>
      {tags.length === 0 ? (
        <p className={styles.meta}>{t("empty")}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("table.tag")}</th>
                <th scope="col" className={styles.num}>{t("table.yours")}</th>
                <th scope="col" className={styles.num}>{t("table.byAi")}</th>
                <th scope="col"><span className={styles.visuallyHidden}>{t("table.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => {
                const editing = mode?.id === tag.id ? mode.kind : null;
                return (
                  <tr key={tag.id}>
                    <td>
                      {editing === "rename" ? (
                        <form className={styles.inline} onSubmit={(e) => { e.preventDefault(); void rename(tag); }} onKeyDown={(e) => e.key === "Escape" && setMode(null)}>
                          <input className={styles.input} aria-label={t("newName", { name: tag.name })} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
                          <button type="submit" className={styles.textButton}>{app("save")}</button>
                        </form>
                      ) : (
                        <span className={styles.tagName}>
                          <span aria-hidden="true" className={styles.dot} style={{ background: tag.colour }} />
                          {tag.name}
                          {tag.createdBy === "mcp" && <span className={styles.byAi}>{t("madeByAi")}</span>}
                        </span>
                      )}
                      {editing && error && <span role="alert" className={styles.error}>{error}</span>}
                    </td>
                    <td className={styles.num}>{tag.count - tag.aiCount}</td>
                    <td className={`${styles.num} ${styles.clay}`}>{tag.aiCount}</td>
                    <td className={styles.actions}>
                      {editing === "merge" ? (
                        <span className={styles.inline}>
                          <select className={styles.input} aria-label={t("mergeLabel", { name: tag.name })} value={target} onChange={(e) => setTarget(e.target.value)}>
                            <option value="">{t("mergeInto")}</option>
                            {tags.filter((x) => x.id !== tag.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                          <button type="button" className={styles.textButton} disabled={!target} onClick={() => remove(tag, tags.find((x) => x.id === target))}>{app("merge")}</button>
                          <button type="button" className={styles.textButton} onClick={() => setMode(null)}>{app("cancel")}</button>
                        </span>
                      ) : editing === "delete" ? (
                        <span className={styles.inline}>
                          {t("delete.confirm", { count: tag.count })}
                          <button type="button" className={styles.textButton} onClick={() => remove(tag)}>{t("delete.yes")}</button>
                          <button type="button" className={styles.textButton} onClick={() => setMode(null)}>{app("cancel")}</button>
                        </span>
                      ) : (
                        <span className={styles.inline}>
                          <button type="button" className={styles.textButton} onClick={() => open(tag.id, "rename", tag.name)}>{app("rename")}</button>
                          <button type="button" className={styles.textButton} onClick={() => open(tag.id, "merge")} disabled={tags.length < 2}>{app("merge")}</button>
                          <button type="button" className={styles.textButton} onClick={() => open(tag.id, "delete")}>{app("delete")}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {toast}
    </section>
  );
}
