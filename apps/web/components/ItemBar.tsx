"use client";

import { isTask, type Item, type Status } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/components/Toast";
import { library, moveItems, went } from "@/lib/actions";
import { isTyping } from "@/lib/keys";
import styles from "./ItemBar.module.css";


export const backHref = (status: Status) => (status === "later" ? "/later" : status === "inbox" ? "/inbox" : "/archive");
const backLabel = (status: Status) => (status === "later" ? "later" : status === "inbox" ? "inbox" : "archive");

// The item page's top bar: back (Esc), Later (l), Archive (e), Done (d) for todos and things.
// `before` runs first on Esc (the note editor flushes its typing there).
// `top` sits above the bar (the reader's progress line); `state` sits after the back link ("Saved").
export function ItemBar({ item, top, state, before }: { item: Item; top?: ReactNode; state?: ReactNode; before?: () => Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(item.status);
  const [origin] = useState<Status>(item.status);
  const [toast, showToast] = useToast();
  const t = useTranslations("app");

  async function move(next: Status) {
    const from = status;
    if (from === next) next = "inbox";
    setStatus(next);
    if (!(await moveItems([item.id], next))) {
      setStatus(from);
      return showToast({ message: t("common.didNotGoThrough") });
    }
    showToast({ message: t(`moved.${next}`), undo: () => void moveItems([item.id], from).then(() => setStatus(from)) });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (isTyping(e.target)) (e.target as HTMLElement).blur();
        return void (before ?? (async () => {}))().then(() => router.push(backHref(origin)));
      }
      if (isTyping(e.target) || window.getSelection()?.toString()) return;
      const run = { l: () => move("later"), e: () => move("archived"), d: () => isTask(item.kind) && move("done") }[e.key];
      if (run) {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {top}
      <div className={styles.bar}>
        <Link href={backHref(origin)} className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t(`shell.nav.${backLabel(origin)}`)} <kbd className={styles.kbd}>Esc</kbd>
        </Link>
        {state && <span className={styles.slot}>{state}</span>}
        <span className={styles.actions}>
          <button type="button" className={styles.action} aria-pressed={status === "later"} onClick={() => move("later")}>
            {t("itemBar.later")} <kbd className={styles.hint}>l</kbd>
          </button>
          <button type="button" className={styles.action} aria-pressed={status === "archived"} onClick={() => move("archived")}>
            {t("itemBar.archive")} <kbd className={styles.hint}>e</kbd>
          </button>
          {isTask(item.kind) && (
            <button type="button" className={styles.action} aria-pressed={status === "done"} onClick={() => move("done")}>
              {t("itemBar.done")} <kbd className={styles.hint}>d</kbd>
            </button>
          )}
        </span>
      </div>
      {toast}
    </>
  );
}

// "Delete" in the item's side column: to the bin, back to the list with Undo there.
export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("app.common");
  return (
    <button
      type="button"
      className={styles.delete}
      onClick={async () => {
        if (await went(library.remove(id))) router.push(`/inbox?deleted=${id}`);
      }}
    >
      {t("delete")}
    </button>
  );
}
