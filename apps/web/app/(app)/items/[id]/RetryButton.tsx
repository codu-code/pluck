"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./item.module.css";

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const t = useTranslations("app.item.failed");
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
      {busy ? t("retrying") : t("retry")}
    </button>
  );
}
