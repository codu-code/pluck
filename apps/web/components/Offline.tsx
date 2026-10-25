"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import styles from "./Offline.module.css";

const subscribe = (fn: () => void) => {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
};
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

// Registers the service worker (production builds only) and tells it the language, so the offline page it keeps is
// in the language you read Pluck in, kept again when you change it. Shows the "offline, will sync" bar.
export function OfflineBar() {
  const online = useOnline();
  const locale = useLocale();
  const t = useTranslations("app.offlineBar");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then((r) => r.active?.postMessage({ locale }));
  }, [locale]);
  if (online) return null;
  return (
    <div className={styles.bar} role="status">
      {t("text")}
    </div>
  );
}

// The mark in the nav while the browser is offline: a cloud struck through, in clay.
export function OfflineMark() {
  const online = useOnline();
  const t = useTranslations("app.shell");
  if (online) return null;
  return (
    <span className={styles.mark}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 12.5h7a2.75 2.75 0 0 0 .55-5.45A4 4 0 0 0 4.3 6.3a3.1 3.1 0 0 0 .2 6.2zM2.5 2.5l11 11" />
      </svg>
      {t("offline")}
    </span>
  );
}
