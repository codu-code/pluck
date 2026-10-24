"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./item.module.css";

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={styles.primary}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/v1/items/${id}/reextract`, { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? "Trying again" : "Retry"}
    </button>
  );
}
