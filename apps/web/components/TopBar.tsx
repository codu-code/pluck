"use client";

import { extractUrls, type PluckResponse, type TextKind } from "@pluck/shared-schemas";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./TopBar.module.css";

export type PluckDraft = { key: string; urls: string[]; text: string | null; kind: TextKind | null };

type Props = {
  sample?: string;
  // The empty inbox's look: 1.5px ink border and a "Pluck it" button, pointing at step 1.
  emphasis?: boolean;
  onPluck?: (draft: PluckDraft) => void;
  onPlucked?: (draft: PluckDraft, result: PluckResponse) => void;
  onFailed?: (draft: PluckDraft) => void;
};

const KINDS: { kind: TextKind; label: string }[] = [
  { kind: "note", label: "Note" },
  { kind: "todo", label: "Todo" },
  { kind: "thing", label: "Thing" },
];

const QUEUE_KEY = "pluck:queue";
type Queued = { draft: PluckDraft; body: Record<string, unknown> };

// Plucks made offline wait in this browser and go when the network is back.
function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}
function writeQueue(q: Queued[]) {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // storage blocked: the pluck stays on screen as a draft row until reload
  }
}

const post = (body: Record<string, unknown>) =>
  fetch("/api/v1/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The paste box (Flow 3): one link, a block of links, or a sentence that becomes a Note, Todo or Thing. No modal.
export function TopBar({ sample, emphasis = false, onPluck, onPlucked, onFailed }: Props) {
  const [value, setValue] = useState(sample ?? "");
  const [kind, setKind] = useState<TextKind>("note");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Send anything queued while offline, now and whenever the network comes back.
  useEffect(() => {
    async function flush() {
      if (!navigator.onLine) return;
      const queue = readQueue();
      writeQueue([]);
      for (const q of queue) {
        try {
          const res = await post(q.body);
          if (res.ok) onPlucked?.(q.draft, (await res.json()) as PluckResponse);
        } catch {
          writeQueue([...readQueue(), q]);
        }
      }
    }
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [onPlucked]);

  const text = value.trim();
  const urls = text ? extractUrls(text) : [];
  const isText = Boolean(text) && urls.length === 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text) return;
    setError(null);
    setNotice(null);
    const draft: PluckDraft = { key: `${Date.now()}`, urls, text: isText ? text : null, kind: isText ? kind : null };
    const body = isText
      ? { text, kind, source: "web", ...(due && kind !== "note" ? { dueAt: new Date(`${due}T09:00:00`).toISOString() } : {}) }
      : { text, source: "web" };
    setValue("");
    setDue("");
    onPluck?.(draft);
    let res: Response;
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      res = await post(body);
    } catch {
      writeQueue([...readQueue(), { draft, body }]);
      setNotice("Plucked. Will sync when you are back online.");
      return;
    }
    const json = await res.json();
    if (res.ok || res.status === 201) {
      window.dispatchEvent(new Event("pluck:counts"));
      const result = json as PluckResponse;
      if (result.rejected.length) setError(`${result.rejected.length} could not be plucked: ${result.rejected[0]!.message}`);
      return onPlucked?.(draft, result);
    }
    setError(json?.rejected?.[0]?.message ?? json?.error?.message ?? "That did not go through.");
    setValue(text);
    onFailed?.(draft);
    input.current?.focus();
  }

  return (
    <form className={styles.bar} onSubmit={submit}>
      <div className={emphasis ? `${styles.pluck} ${styles.emphasis}` : styles.pluck}>
        <label className={styles.pluckLabel} htmlFor="pluck-box">
          Pluck
        </label>
        <input
          ref={input}
          id="pluck-box"
          className={styles.input}
          type="text"
          name="pluck"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste one link or many, or type a note"
          aria-describedby="pluck-hint"
          autoComplete="off"
        />
        {emphasis ? (
          <button type="submit" className={styles.button}>
            Pluck it
          </button>
        ) : (
          <kbd className={styles.kbd}>c</kbd>
        )}
      </div>
      <Link href="/search" className={styles.search}>
        Search<kbd className={styles.kbd}>/</kbd>
      </Link>
      <div id="pluck-hint" className={styles.hint} aria-live="polite">
        {notice && !text && <span>{notice}</span>}
        {urls.length > 1 && <span>{urls.length} links. Enter plucks them all.</span>}
        {isText && (
          <span className={styles.textKinds}>
            <span role="radiogroup" aria-label="Pluck as" className={styles.segments}>
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.kind}
                  className={styles.segment}
                  onClick={() => setKind(k.kind)}
                >
                  {k.label}
                </button>
              ))}
            </span>
            {kind !== "note" && (
              <label className={styles.due}>
                Due
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={styles.dateInput} />
              </label>
            )}
            <span>Enter plucks it as a {kind === "note" ? "Note" : kind === "todo" ? "Todo" : "Thing"}.</span>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
