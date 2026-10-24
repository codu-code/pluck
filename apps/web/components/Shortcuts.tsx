"use client";

import { useEffect, useRef } from "react";
import styles from "./Shortcuts.module.css";

const KEYS: [string, string][] = [
  ["/", "Search"], ["c", "Pluck box"], ["j  k", "Move down and up"], ["o", "Open"], ["l", "Later (or back to the Inbox)"],
  ["e", "Archive"], ["d", "Done (todos and things)"], ["x", "Select"], ["Esc", "Clear the selection, or go back"], ["?", "This list"],
];

// The "?" cheat sheet.
export function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className={styles.title}>Shortcuts</h2>
      <dl className={styles.list}>
        {KEYS.map(([k, label]) => (
          <div key={k} className={styles.row}>
            <dt>{k.split("  ").map((part) => <kbd key={part} className={styles.kbd}>{part}</kbd>)}</dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={styles.close} onClick={onClose}>Close</button>
    </dialog>
  );
}
