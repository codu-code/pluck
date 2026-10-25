"use client";

import type { ListShare } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import styles from "./list.module.css";

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

// Sharing with people, See only: they get an email with a link, sign in with it, and find the List in their Lists.
export function People({ listId, initial, say }: { listId: string; initial: ListShare[]; say: (message: string) => void }) {
  const [people, setPeople] = useState(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("app.people");
  const app = useTranslations("app");
  const base = `/api/v1/lists/${listId}/people`;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await send(base, "POST", { email });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error?.message ?? app("common.didNotGoThrough"));
    const person = (body as { person: ListShare }).person;
    setPeople((cur) => (cur.some((p) => p.id === person.id) ? cur : [...cur, person]));
    setEmail("");
    say(t("added", { email: person.email }));
  }

  async function remove(p: ListShare) {
    const res = await send(`${base}/${p.id}`, "DELETE");
    if (!res.ok) return say(app("common.didNotGoThrough"));
    setPeople((cur) => cur.filter((x) => x.id !== p.id));
    say(t("removed", { email: p.email }));
  }

  return (
    <div className={styles.people}>
      <form className={styles.linkRow} onSubmit={add}>
        <input
          className={styles.peopleInput}
          type="email"
          required
          autoComplete="off"
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className={styles.primarySmall} disabled={busy}>{busy ? t("sharing") : t("share")}</button>
      </form>
      {error && <span role="alert" className={styles.peopleError}>{error}</span>}
      {people.length > 0 && (
        <ul className={styles.peopleList} aria-label={t("label")}>
          {people.map((p) => (
            <li key={p.id} className={styles.person}>
              <span className={styles.personEmail}>{p.email}</span>
              <button type="button" className={styles.personRemove} onClick={() => void remove(p)} aria-label={t("stop", { email: p.email })}>{app("common.remove")}</button>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.meta}>{people.length ? t("some") : t("none")}</span>
    </div>
  );
}
