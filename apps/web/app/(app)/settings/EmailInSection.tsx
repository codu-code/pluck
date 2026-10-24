"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import styles from "./settings.module.css";

// Email-in (Settings board): forward a newsletter, it lands as a Read item.
export function EmailInSection({ initial }: { initial: string }) {
  const [address, setAddress] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [toast, showToast] = useToast();
  return (
    <section id="email" className={styles.sectionPlain}>
      <h2 className={styles.h2}>Email-in</h2>
      <p className={styles.meta}>Forward a newsletter here. It lands as a Read item.</p>
      <span className={styles.copyRow}>
        <code className={styles.code}>{address}</code>
        <button
          type="button"
          className={styles.inkButton}
          onClick={async () => {
            await navigator.clipboard?.writeText(address).catch(() => {});
            showToast({ message: "Address copied." });
          }}
        >
          Copy
        </button>
      </span>
      {confirm ? (
        <span className={styles.confirm} style={{ color: "var(--ink)" }}>
          The old address stops working at once.
          <button
            type="button"
            className={styles.textButton}
            onClick={async () => {
              const res = await fetch("/api/v1/email-in/regenerate", { method: "POST" });
              setConfirm(false);
              if (res.ok) {
                setAddress(((await res.json()) as { address: string }).address);
                showToast({ message: "New address ready. Update anything that forwards to the old one." });
              }
            }}
          >
            Make a new one
          </button>
          <button type="button" className={styles.textButton} onClick={() => setConfirm(false)}>Cancel</button>
        </span>
      ) : (
        <button type="button" className={styles.linkButton} style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => setConfirm(true)}>
          Regenerate address
        </button>
      )}
      {toast}
    </section>
  );
}
