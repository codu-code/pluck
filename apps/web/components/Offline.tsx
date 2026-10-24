"use client";

import { useEffect, useState } from "react";
import styles from "./Offline.module.css";

// Registers the service worker (production builds only) and shows the "offline, will sync" bar.
export function OfflineBar() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js");
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div className={styles.bar} role="status">
      Offline. Plucks will sync when you are back.
    </div>
  );
}
