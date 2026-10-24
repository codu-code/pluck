import { Icon, Logo } from "@pluck/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./standalone.module.css";

// The pages between the site and the app: sign-in, offline, not found, errors, the email's one-tap pages and
// the OAuth landings. One layout so they share the site's voice: a big display line, a short lede, the next step,
// and on wide screens a drawn piece of the product beside it.
// `title` takes one line per sentence ("One link." / "No password."), so a short line breaks where it is read.
// `size="md"` is for long lines, like an AI tool's name on the consent screen.
// `art` is decorative (hidden from screen readers) unless `artIsContent`.
export function Standalone({
  title, lede, art, artIsContent = false, wide = false, size = "lg", children,
}: { title: ReactNode | ReactNode[]; lede?: ReactNode; art?: ReactNode; artIsContent?: boolean; wide?: boolean; size?: "lg" | "md"; children?: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" aria-label="Pluck home" className={styles.home}><Logo size={26} /></Link>
      </header>
      <main className={`${styles.main} ${art ? styles.withArt : ""}`}>
        <div className={`${styles.copy} ${wide ? styles.copyWide : ""}`}>
          <h1 className={`${styles.title} ${size === "md" ? styles.titleMd : ""}`}>
            {Array.isArray(title) ? title.map((line, i) => <span key={i} className={styles.titleLine}>{line} </span>) : title}
          </h1>
          {lede && <p className={styles.lede}>{lede}</p>}
          {children}
        </div>
        {art && <div className={styles.art} aria-hidden={artIsContent ? undefined : true}>{art}</div>}
      </main>
    </div>
  );
}

// The accent full stop (or question mark) the site ends its big lines with.
export const Dot = ({ children = "." }: { children?: string }) => <span className={styles.dot}>{children}</span>;

export const Actions = ({ children }: { children: ReactNode }) => <div className={styles.actions}>{children}</div>;

// The "Plucked." stamp from the home page, for a moment worth marking.
export const Stamp = ({ children }: { children: ReactNode }) => (
  <div className={styles.stamp}>
    <span className={styles.stampTick}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="#151A13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
    <b>{children}</b>
  </div>
);

// The app icon, big and a little pleased with itself, for pages with nothing of the product to draw.
export const BigMark = () => (
  <span className={styles.mark}><Icon size={220} tone="forest" /></span>
);

export { styles as standaloneStyles };
