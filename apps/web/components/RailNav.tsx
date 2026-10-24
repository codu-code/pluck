"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";

const LINKS = [
  { href: "/inbox", label: "Inbox" },
  { href: "/later", label: "Later" },
  { href: "/lists", label: "Lists" },
  { href: "/archive", label: "Archive" },
  { href: "/settings", label: "Settings" },
];

export function RailNav() {
  const path = usePathname();
  return (
    <div className={styles.links}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={styles.link} aria-current={path.startsWith(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
