"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

type Toast = { message: string; undo?: () => void };

// One toast at a time, bottom centre, forest ground (Later board). Undo is a button, never a timer race.
export function useToast(): [ReactNode, (t: Toast) => void] {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div className={styles.toast}>
          {toast.message}
          {toast.undo && (
            <button
              type="button"
              className={styles.undo}
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
  return [node, show];
}
