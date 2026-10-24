import { Logo } from "@pluck/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { OfflineBar } from "./Offline";
import { RailNav } from "./RailNav";
import styles from "./AppShell.module.css";

// The web app frame from the Main and Empty boards: rail on the left, pluck box and search on top.
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const display = user.name || user.email.split("@")[0] || user.email;
  return (
    <div className={styles.frame}>
      <nav aria-label="Main" className={styles.rail}>
        <Link href="/inbox" aria-label="Pluck" className={styles.home}>
          <Logo size={24} />
        </Link>
        <RailNav />
        <div className={styles.me}>
          <span className={styles.avatar} aria-hidden="true">
            {display.slice(0, 2).toUpperCase()}
          </span>
          <span className={styles.meName}>{display}</span>
        </div>
      </nav>
      <main className={styles.main}>
        <OfflineBar />
        {children}
      </main>
    </div>
  );
}
