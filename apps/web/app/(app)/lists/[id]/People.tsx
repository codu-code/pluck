"use client";

import type { ListShare } from "@pluck/shared-schemas";
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
  const base = `/api/v1/lists/${listId}/people`;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await send(base, "POST", { email });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error?.message ?? "That did not go through.");
    const person = (body as { person: ListShare }).person;
    setPeople((cur) => (cur.some((p) => p.id === person.id) ? cur : [...cur, person]));
    setEmail("");
    say(`Shared with ${person.email}. They get an email with a link.`);
  }

  async function remove(p: ListShare) {
    const res = await send(`${base}/${p.id}`, "DELETE");
    if (!res.ok) return say("That did not go through.");
    setPeople((cur) => cur.filter((x) => x.id !== p.id));
    say(`${p.email} can no longer see it.`);
  }

  return (
    <div className={styles.people}>
      <form className={styles.linkRow} onSubmit={add}>
        <input
          className={styles.peopleInput}
          type="email"
          required
          autoComplete="off"
          placeholder="Share with someone: their email"
          aria-label="Share with someone: their email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className={styles.primarySmall} disabled={busy}>{busy ? "Sharing" : "Share"}</button>
      </form>
      {error && <span role="alert" className={styles.peopleError}>{error}</span>}
      {people.length > 0 && (
        <ul className={styles.peopleList} aria-label="People who can see it">
          {people.map((p) => (
            <li key={p.id} className={styles.person}>
              <span className={styles.personEmail}>{p.email}</span>
              <button type="button" className={styles.personRemove} onClick={() => void remove(p)} aria-label={`Stop sharing with ${p.email}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.meta}>{people.length ? "They can see it; only you change it." : "They see it, never your tags or ticks; only you change it."}</span>
    </div>
  );
}
