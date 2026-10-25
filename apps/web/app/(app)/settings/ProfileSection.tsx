"use client";

import { funHandle, HANDLE, handleMove, type Me } from "@pluck/shared-schemas";
import { useState } from "react";
import styles from "./settings.module.css";

const send = (body: unknown) => fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Name and handle (Settings board, top). The name saves on blur. The handle is in public List links, so a change
// says what moves and waits for Save; Make one up only fills the field.
export function ProfileSection({ initial, publicLists }: { initial: Me; publicLists: number }) {
  const [me, setMe] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(body: { name?: string; handle?: string }, label: string) {
    setError(null);
    const res = await send(body);
    const json = await res.json();
    if (!res.ok) return setError(json.error.message);
    setMe(json.me);
    setSaved(label);
  }

  const locked = Boolean(me.handleChangeableAt && new Date(me.handleChangeableAt) > new Date());
  const next = handle.trim().replace(/^@/, "");
  const changed = next !== (me.handle ?? "");
  const valid = HANDLE.test(next);
  const edit = (value: string) => {
    setHandle(value.toLowerCase());
    setError(null);
    setSaved(null);
  };
  return (
    <section className={styles.profile} aria-label="Profile">
      <label className={styles.profileField}>
        <span className={styles.label}>Name</span>
        <input className={styles.profileInput} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== me.name && save({ name }, "Name saved.")} />
      </label>
      <div className={styles.profileField}>
        <label className={styles.stack}>
          <span className={styles.label}>Handle, for public lists</span>
          <span className={styles.handleBox}>
            <span className={styles.prefix}>getpluck.io/@</span>
            <input
              className={styles.handleInput}
              value={handle}
              readOnly={locked}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && changed && valid && void save({ handle: next }, "Handle saved.")}
            />
            {!locked && <button type="button" className={styles.textButton} onClick={() => edit(funHandle())}>Make one up</button>}
          </span>
        </label>
        {changed ? (
          <div className={styles.handleChange}>
            <p className={styles.handleWarning} role={error ? "alert" : "status"}>
              {error ?? (valid ? handleMove(publicLists, "getpluck.io", next) : "3 to 24 lowercase letters, numbers or hyphens.")}
            </p>
            <div className={styles.handleActions}>
              <button type="button" className={styles.primaryButton} disabled={!valid} onClick={() => void save({ handle: next }, "Handle saved.")}>
                Save @{valid ? next : "…"}
              </button>
              <button type="button" className={styles.textButton} onClick={() => edit(me.handle ?? "")}>Keep @{me.handle}</button>
            </div>
          </div>
        ) : (
          <span className={styles.profileHint} role={error ? "alert" : "status"}>
            {error ?? saved ?? (locked ? "Only shown on lists you make public. It can change once a month." : "Only shown on lists you make public.")}
          </span>
        )}
      </div>
    </section>
  );
}
