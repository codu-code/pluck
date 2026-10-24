import Link from "next/link";
import styles from "./EmptyInbox.module.css";

// The Empty board's three ways to start.
export function EmptyInbox() {
  return (
    <div className={styles.empty}>
      <div className={styles.head}>
        <h1 className={styles.title}>Nothing plucked yet.</h1>
        <p className={styles.lede}>Three ways to start. The first one takes a second.</p>
      </div>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.num}>1</span>
          <span className={styles.text}>
            <b>Press Pluck it above</b>
            <span>The sample link is already there. Watch it land.</span>
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.num}>2</span>
          <span className={styles.text}>
            <b>Add the extension</b>
            <span>One click, or Alt+Shift+P, on any page.</span>
          </span>
          <span className={styles.actions}>
            <Link href="/connect#extension" className={styles.action}>Chrome</Link>
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.num}>3</span>
          <span className={styles.text}>
            <b>Pluck from your phone</b>
            <span>The iOS app, or the Pluck Shortcut until it ships.</span>
          </span>
          <span className={styles.actions}>
            <Link href="/connect#ios" className={styles.action}>iOS app</Link>
            <Link href="/settings#shortcut" className={styles.action}>Add the Shortcut</Link>
          </span>
        </li>
      </ol>
    </div>
  );
}

// A quiet empty state for the other lists.
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{body}</p>
      </div>
    </div>
  );
}
