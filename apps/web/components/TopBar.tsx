"use client";

import { extractUrls, type PluckResponse, type TextKind } from "@pluck/shared-schemas";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
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

// The paste box (Flow 3): one link, a block of links, or a sentence that becomes a Note, Todo or Thing. No modal.
export function TopBar({ sample, emphasis = false, onPluck, onPlucked, onFailed }: Props) {
  const [value, setValue] = useState(sample ?? "");
  const [kind, setKind] = useState<TextKind>("note");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const text = value.trim();
  const urls = text ? extractUrls(text) : [];
  const isText = Boolean(text) && urls.length === 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text) return;
    setError(null);
    const draft: PluckDraft = { key: `${Date.now()}`, urls, text: isText ? text : null, kind: isText ? kind : null };
    const body = isText
      ? { text, kind, source: "web", ...(due && kind !== "note" ? { dueAt: new Date(`${due}T09:00:00`).toISOString() } : {}) }
      : { text, source: "web" };
    setValue("");
    setDue("");
    onPluck?.(draft);
    const res = await fetch("/api/v1/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (res.ok || res.status === 201) {
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
