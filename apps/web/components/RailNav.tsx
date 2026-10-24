"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./AppShell.module.css";

const LINKS = [
  { href: "/inbox", label: "Inbox", count: "inbox" },
  { href: "/later", label: "Later", count: "later" },
  { href: "/lists", label: "Lists", count: "lists" },
  { href: "/archive", label: "Archive" },
  { href: "/settings", label: "Settings" },
];

// Settings sections, added as their slices land (Settings board order).
const SETTINGS = [{ href: "#email", label: "Email-in" }, { href: "#expiry", label: "Expiry and archive" }, { href: "#tags", label: "Tags" }];

export const COUNTS_CHANGED = "pluck:counts";

export function RailNav({ counts: initial }: { counts: Record<string, number> }) {
  const path = usePathname();
  const [counts, setCounts] = useState(initial);
  // The layout does not re-render on navigation, so the rail refreshes its own numbers.
  useEffect(() => {
    const load = () => void fetch("/api/v1/counts").then((r) => (r.ok ? r.json() : null)).then((c) => c && setCounts(c));
    load();
    window.addEventListener(COUNTS_CHANGED, load);
    return () => window.removeEventListener(COUNTS_CHANGED, load);
  }, [path]);
  return (
    <>
      <div className={styles.links}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={styles.link} aria-current={path.startsWith(l.href) ? "page" : undefined}>
            {l.label}
            {"count" in l && counts[l.count!] ? <span className={styles.count}>{counts[l.count!]}</span> : null}
          </Link>
        ))}
      </div>
      {path.startsWith("/settings") && (
        <div className={styles.sublinks}>
          {SETTINGS.map((l) => (
            <a key={l.href} href={l.href} className={styles.sublink}>{l.label}</a>
          ))}
        </div>
      )}
    </>
  );
}
