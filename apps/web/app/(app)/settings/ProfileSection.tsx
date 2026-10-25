"use client";

import type { Me } from "@pluck/shared-schemas";
import { useState } from "react";
import styles from "./settings.module.css";

const send = (body: unknown) => fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Name and handle (Settings board, top). Each saves on blur; the handle shows its link.
export function ProfileSection({ initial }: { initial: Me }) {
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

  async function makeOneUp() {
    setError(null);
    const res = await fetch("/api/v1/me/handle", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return setError(json.error.message);
    setMe(json.me);
    setHandle(json.me.handle ?? "");
    setSaved("Made one up. Not keen? Again, or type your own.");
  }

  const locked = Boolean(me.handleChangeableAt && new Date(me.handleChangeableAt) > new Date());
  return (
    <section className={styles.profile} aria-label="Profile">
      <label className={styles.profileField}>
        <span className={styles.label}>Name</span>
        <input className={styles.profileInput} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== me.name && save({ name }, "Name saved.")} />
      </label>
      <label className={styles.profileField}>
        <span className={styles.label}>Handle, for public lists</span>
        <span className={styles.handleBox}>
          <span className={styles.prefix}>getpluck.io/@</span>
          <input
            className={styles.handleInput}
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            onBlur={() => handle && handle !== (me.handle ?? "") && save({ handle }, "Handle saved.")}
          />
          {!locked && <button type="button" className={styles.textButton} onClick={() => void makeOneUp()}>Make one up</button>}
        </span>
      </label>
      <span className={styles.profileHint} role={error ? "alert" : "status"}>
        {error ?? saved ?? (locked ? "Only shown on lists you make public. It can change once a month." : "Only shown on lists you make public.")}
      </span>
    </section>
  );
}
