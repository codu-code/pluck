"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import styles from "./Shortcuts.module.css";

const KEYS = [
  ["/", "search"], ["c", "pluckBox"], ["j  k", "move"], ["o", "open"], ["l", "later"],
  ["e", "archive"], ["d", "done"], ["t", "tag"], ["a", "list"], ["x", "select"], ["Esc", "escape"], ["?", "help"],
] as const;

// The "?" cheat sheet.
export function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("app.shortcuts");
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className={styles.title}>{t("title")}</h2>
      <dl className={styles.list}>
        {KEYS.map(([k, label]) => (
          <div key={k} className={styles.row}>
            <dt>{k.split("  ").map((part) => <kbd key={part} className={styles.kbd}>{part}</kbd>)}</dt>
            <dd>{t(`keys.${label}`)}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={styles.close} onClick={onClose}>{t("close")}</button>
    </dialog>
  );
}
