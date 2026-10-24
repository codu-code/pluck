"use client";

import type { Tag } from "@pluck/shared-schemas";
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

  const refresh = async () => setTags(await fetchTags());
  const open = (id: string, kind: "rename" | "merge" | "delete", name = "") => {
    setMode({ id, kind });
    setDraft(name);
    setTarget("");
    setError(null);
  };

  async function rename(t: Tag) {
    const res = await fetch(`/api/v1/tags/${t.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft }) });
    if (!res.ok) return setError(((await res.json()) as { error: { message: string } }).error.message);
    setMode(null);
    await refresh();
  }

  async function remove(t: Tag, into?: Tag) {
    const qs = into ? `reassignTo=${into.id}` : "removeFromItems=true";
    const res = await fetch(`/api/v1/tags/${t.id}?${qs}`, { method: "DELETE" });
    if (!res.ok) return setError("That did not go through.");
    setMode(null);
    await refresh();
    showToast({ message: into ? `Merged “${t.name}” into “${into.name}”.` : `“${t.name}” is gone. Its items are still here.` });
  }

  async function purge() {
    const res = await fetch("/api/v1/tags/purge-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 7 }) });
    setConfirmPurge(false);
    if (!res.ok) return showToast({ message: "That did not go through." });
    const { assignments } = (await res.json()) as { assignments: number };
    setAiWeek(0);
    await refresh();
    showToast({ message: `Removed ${assignments} tag${assignments === 1 ? "" : "s"} your AI added this week.` });
  }

  return (
    <section id="tags" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h2}>Tags</h2>
        {confirmPurge ? (
          <span className={styles.confirm}>
            Remove {aiWeek} tag{aiWeek === 1 ? "" : "s"} your AI added this week?
            <button type="button" className={styles.clayButton} onClick={purge}>Yes, remove them</button>
            <button type="button" className={styles.textButton} onClick={() => setConfirmPurge(false)}>Cancel</button>
          </span>
        ) : (
          <button type="button" className={styles.clayButton} disabled={aiWeek === 0} onClick={() => setConfirmPurge(true)}>
            Remove everything AI tagged this week · {aiWeek}
          </button>
        )}
      </div>
      {tags.length === 0 ? (
        <p className={styles.meta}>No tags yet. Press t on any item to make one.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col" className={styles.num}>Yours</th>
                <th scope="col" className={styles.num}>By AI</th>
                <th scope="col"><span className={styles.visuallyHidden}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => {
                const editing = mode?.id === t.id ? mode.kind : null;
                return (
                  <tr key={t.id}>
                    <td>
                      {editing === "rename" ? (
                        <form className={styles.inline} onSubmit={(e) => { e.preventDefault(); void rename(t); }} onKeyDown={(e) => e.key === "Escape" && setMode(null)}>
                          <input className={styles.input} aria-label={`New name for ${t.name}`} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
                          <button type="submit" className={styles.textButton}>Save</button>
                        </form>
                      ) : (
                        <span className={styles.tagName}>
                          <span aria-hidden="true" className={styles.dot} style={{ background: t.colour }} />
                          {t.name}
                          {t.createdBy === "mcp" && <span className={styles.byAi}>made by AI</span>}
                        </span>
                      )}
                      {editing && error && <span role="alert" className={styles.error}>{error}</span>}
                    </td>
                    <td className={styles.num}>{t.count - t.aiCount}</td>
                    <td className={`${styles.num} ${styles.clay}`}>{t.aiCount}</td>
                    <td className={styles.actions}>
                      {editing === "merge" ? (
                        <span className={styles.inline}>
                          <select className={styles.input} aria-label={`Merge ${t.name} into`} value={target} onChange={(e) => setTarget(e.target.value)}>
                            <option value="">Merge into…</option>
                            {tags.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                          <button type="button" className={styles.textButton} disabled={!target} onClick={() => remove(t, tags.find((x) => x.id === target))}>Merge</button>
                          <button type="button" className={styles.textButton} onClick={() => setMode(null)}>Cancel</button>
                        </span>
                      ) : editing === "delete" ? (
                        <span className={styles.inline}>
                          Take it off {t.count} item{t.count === 1 ? "" : "s"}?
                          <button type="button" className={styles.textButton} onClick={() => remove(t)}>Yes, delete the tag</button>
                          <button type="button" className={styles.textButton} onClick={() => setMode(null)}>Cancel</button>
                        </span>
                      ) : (
                        <span className={styles.inline}>
                          <button type="button" className={styles.textButton} onClick={() => open(t.id, "rename", t.name)}>Rename</button>
                          <button type="button" className={styles.textButton} onClick={() => open(t.id, "merge")} disabled={tags.length < 2}>Merge</button>
                          <button type="button" className={styles.textButton} onClick={() => open(t.id, "delete")}>Delete</button>
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
