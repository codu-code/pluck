"use client";

import type { List, SharedListSummary } from "@pluck/shared-schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import { when } from "@/lib/format";
import styles from "./lists.module.css";
import { useNow } from "@/lib/use-now";

const LOCK = "M4.5 7.5V5a3.5 3.5 0 0 1 7 0v2.5M3.5 7.5h9v6h-9z";
const GLOBE = "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM2 8h12M8 2c1.8 1.7 2.6 3.8 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.2 5.4 8S6.2 3.7 8 2z";

// The Lists board: what you are making, newest activity first.
export function ListsView({ initial, shared }: { initial: List[]; shared: SharedListSummary[] }) {
  const router = useRouter();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [toast, showToast] = useToast();
  const now = useNow();

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/v1/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, purpose }) });
    if (res.ok) router.push(`/lists/${((await res.json()) as { list: List }).list.id}`);
    else showToast({ message: "That did not go through." });
  }

  return (
    <>
      <TopBar onPluck={() => showToast({ message: "Plucked to the Inbox." })} />
      <div className={styles.page}>
        <div className={styles.head}>
          <div className={styles.titles}>
            <h1 className={styles.title}>Lists</h1>
            <span className={styles.meta}>What you are making. A book, an issue, a talk, a trip, things to buy.</span>
          </div>
          {!making && <button type="button" className={styles.primary} onClick={() => setMaking(true)}>New list</button>}
        </div>
        {making && (
          <form className={styles.newList} onSubmit={create} onKeyDown={(e) => e.key === "Escape" && setMaking(false)}>
            <label className={styles.field}>
              <span>Name</span>
              <input className={styles.input} value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Talk on MCP auth" />
            </label>
            <label className={`${styles.field} ${styles.grow}`}>
              <span>Purpose, one line</span>
              <input className={styles.input} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Twenty minutes for the November meetup." />
            </label>
            <button type="submit" className={styles.primary} disabled={!name.trim()}>Make the list</button>
            <button type="button" className={styles.textButton} onClick={() => setMaking(false)}>Cancel</button>
          </form>
        )}
        {initial.length === 0 ? (
          <p className={styles.meta}>No lists yet. Press a on any item to start one, or make one here.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name and purpose</th>
                  <th scope="col" className={styles.visCol}>Visibility</th>
                  <th scope="col" className={styles.num}>Ticked</th>
                  <th scope="col" className={styles.num}>Last added</th>
                </tr>
              </thead>
              <tbody>
                {initial.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className={styles.nameLine}>
                        <Link href={`/lists/${l.id}`} className={styles.name}>{l.name}</Link>
                        {l.createdBy === "mcp" && <span className={styles.byAi}><span aria-hidden="true" className={styles.dot} />by AI</span>}
                      </span>
                      {l.purpose && <div className={styles.purpose}>{l.purpose}</div>}
                    </td>
                    <td>
                      <span className={styles.vis}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                          <path d={l.visibility === "public" ? GLOBE : LOCK} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {l.visibility === "public" ? `Public · ${l.views} views` : "Private"}
                      </span>
                    </td>
                    <td className={styles.num}>{l.tickedCount} of {l.itemCount}</td>
                    <td className={`${styles.num} ${styles.meta}`}>{l.lastAddedAt ? (now ? when(l.lastAddedAt, now) : "") : "Not yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shared.length > 0 && (
          <section className={styles.shared} aria-labelledby="shared-with-you">
            <h2 id="shared-with-you" className={styles.h2}>Shared with you</h2>
            <ul className={styles.sharedList}>
              {shared.map((l) => (
                <li key={l.id} className={styles.sharedRow}>
                  <Link href={`/shared/${l.id}`} className={styles.name}>{l.name}</Link>
                  {l.purpose && <div className={styles.purpose}>{l.purpose}</div>}
                  <div className={styles.purpose}>From {l.owner.name ? `${l.owner.name} (@${l.owner.handle})` : `@${l.owner.handle}`} · {l.itemCount} {l.itemCount === 1 ? "item" : "items"} · see only</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className={styles.foot}>Items in a list never expire. A list is a plan.</p>
      </div>
      {toast}
    </>
  );
}
