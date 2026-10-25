"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./AppShell.module.css";

const LINKS = [
  { href: "/inbox", label: "inbox", count: "inbox" },
  { href: "/later", label: "later", count: "later" },
  { href: "/lists", label: "lists", count: "lists" },
  { href: "/archive", label: "archive" },
  { href: "/settings", label: "settings" },
] as const;

// Settings sections, in Settings board order.
const SETTINGS = [
  { href: "#ai", label: "ai" },
  { href: "#email", label: "email" },
  { href: "#keys", label: "keys" },
  { href: "#language", label: "language" },
  { href: "#expiry", label: "expiry" },
  { href: "#tags", label: "tags" },
  { href: "#import", label: "import" },
  { href: "#delete", label: "delete" },
] as const;

export const COUNTS_CHANGED = "pluck:counts";

export function RailNav({ counts: initial }: { counts: Record<string, number> }) {
  const path = usePathname();
  const t = useTranslations("app.shell");
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
            {t(`nav.${l.label}`)}
            {"count" in l && counts[l.count] ? <span className={styles.count}>{counts[l.count]}</span> : null}
          </Link>
        ))}
      </div>
      {path.startsWith("/settings") && (
        <div className={styles.sublinks}>
          {SETTINGS.map((l) => (
            <a key={l.href} href={l.href} className={styles.sublink}>{t(`settingsNav.${l.label}`)}</a>
          ))}
        </div>
      )}
    </>
  );
}
