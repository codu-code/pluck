import { Logo } from "@pluck/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { OfflineBar, OfflineMark } from "./Offline";
import { RailNav } from "./RailNav";
import { TimezoneSync } from "./TimezoneSync";
import styles from "./AppShell.module.css";

// The web app frame from the Main and Empty boards: rail on the left, pluck box and search on top.
export function AppShell({ user, counts, timezone, children }: { user: SessionUser; counts: Record<string, number>; timezone: string; children: ReactNode }) {
  const display = user.name || user.email.split("@")[0] || user.email;
  const t = useTranslations("app.shell");
  return (
    <div className={styles.frame}>
      <nav aria-label={t("main")} className={styles.rail}>
        <Link href="/inbox" aria-label="Pluck" className={styles.home}>
          <Logo size={24} />
        </Link>
        <OfflineMark />
        <RailNav counts={counts} />
        <div className={styles.me}>
          <span className={styles.avatar} aria-hidden="true">
            {display.slice(0, 2).toUpperCase()}
          </span>
          <span className={styles.meName}>{display}</span>
        </div>
      </nav>
      <TimezoneSync current={timezone} />
      <main className={styles.main}>
        <OfflineBar />
        {children}
      </main>
    </div>
  );
}
