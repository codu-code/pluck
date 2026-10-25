"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import styles from "./settings.module.css";

// Email-in (Settings board): forward a newsletter, it lands as a Read item.
export function EmailInSection({ initial }: { initial: string }) {
  const [address, setAddress] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [toast, showToast] = useToast();
  const t = useTranslations("app.settings.emailIn");
  const app = useTranslations("app.common");
  return (
    <section id="email" className={styles.sectionPlain}>
      <h2 className={styles.h2}>{t("title")}</h2>
      <p className={styles.meta}>{t("lede")}</p>
      <span className={styles.copyRow}>
        <code className={styles.code}>{address}</code>
        <button
          type="button"
          className={styles.inkButton}
          onClick={async () => {
            await navigator.clipboard?.writeText(address).catch(() => {});
            showToast({ message: t("copied") });
          }}
        >
          {app("copy")}
        </button>
      </span>
      {confirm ? (
        <span className={styles.confirm} style={{ color: "var(--ink)" }}>
          {t("confirm")}
          <button
            type="button"
            className={styles.textButton}
            onClick={async () => {
              const res = await fetch("/api/v1/email-in/regenerate", { method: "POST" });
              setConfirm(false);
              if (res.ok) {
                setAddress(((await res.json()) as { address: string }).address);
                showToast({ message: t("ready") });
              }
            }}
          >
            {t("makeNew")}
          </button>
          <button type="button" className={styles.textButton} onClick={() => setConfirm(false)}>{app("cancel")}</button>
        </span>
      ) : (
        <button type="button" className={styles.linkButton} style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => setConfirm(true)}>
          {t("regenerate")}
        </button>
      )}
      {toast}
    </section>
  );
}
