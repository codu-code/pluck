"use client";

import { useEffect, useState } from "react";
import styles from "./Fold.module.css";

const KEY = (id: string) => `pluck.fold.${id}`;

// Whether a group is folded, remembered on this device. Storage can be missing (private windows): then it is not remembered.
export function useFolded(id: string): [boolean, () => void] {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      setFolded(localStorage.getItem(KEY(id)) === "1");
    } catch {}
  }, [id]);
  const toggle = () =>
    setFolded((was) => {
      try {
        if (was) localStorage.removeItem(KEY(id));
        else localStorage.setItem(KEY(id), "1");
      } catch {}
      return !was;
    });
  return [folded, toggle];
}

// A group's header (a month in the Archive, the marked rows of a List): a button that folds what is under it.
export function FoldHeader({ id, label, count, folded, onToggle }: { id: string; label: string; count: number; folded: boolean; onToggle: () => void }) {
  return (
    <h2 className={styles.head}>
      <button type="button" className={styles.button} aria-expanded={!folded} aria-controls={id} onClick={onToggle}>
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{label}</span>{" "}
        <span className={styles.count}>{count}</span>
      </button>
    </h2>
  );
}
