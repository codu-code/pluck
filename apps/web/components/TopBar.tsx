"use client";

import type { CreateItemResult } from "@pluck/shared-schemas";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import styles from "./TopBar.module.css";

type Props = {
  sample?: string;
  // The empty inbox's look: 1.5px ink border and a "Pluck it" button, pointing at step 1.
  emphasis?: boolean;
  onPluck?: (url: string) => void;
  onPlucked?: (result: CreateItemResult, url: string) => void;
  onFailed?: (url: string, message: string) => void;
};

export function TopBar({ sample, emphasis = false, onPluck, onPlucked, onFailed }: Props) {
  const [value, setValue] = useState(sample ?? "");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const url = value.trim();
    if (!url) return;
    setError(null);
    setValue("");
    onPluck?.(url);
    const res = await fetch("/api/v1/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, source: "web" }),
    });
    const body = await res.json();
    if (res.ok) return onPlucked?.(body as CreateItemResult, url);
    const message = body?.error?.message ?? "That did not go through.";
    setError(message);
    setValue(url);
    onFailed?.(url, message);
    input.current?.focus();
  }

  return (
    <div className={styles.bar}>
      <form className={emphasis ? `${styles.pluck} ${styles.emphasis}` : styles.pluck} onSubmit={submit}>
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
          aria-describedby={error ? "pluck-error" : undefined}
          autoComplete="off"
        />
        {emphasis ? (
          <button type="submit" className={styles.button}>
            Pluck it
          </button>
        ) : (
          <kbd className={styles.kbd}>c</kbd>
        )}
      </form>
      <Link href="/search" className={styles.search}>
        Search<kbd className={styles.kbd}>/</kbd>
      </Link>
      {error && (
        <p id="pluck-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
