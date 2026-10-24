import Link from "next/link";
import styles from "./TopBar.module.css";

// Pluck box and search, from the Empty board. The box starts taking plucks in slice 2.
// `emphasis` is the empty inbox's 1.5px ink border, pointing at step 1.
export function TopBar({ sample, emphasis = false }: { sample?: string; emphasis?: boolean }) {
  return (
    <div className={styles.bar}>
      <label className={emphasis ? `${styles.pluck} ${styles.emphasis}` : styles.pluck}>
        <span className={styles.pluckLabel}>Pluck</span>
        <input
          className={styles.input}
          type="text"
          name="pluck"
          defaultValue={sample}
          placeholder="Paste one link or many, or type a note"
          aria-label="Pluck a link or note"
        />
        <button type="button" className={styles.button}>
          Pluck it
        </button>
      </label>
      <Link href="/search" className={styles.search}>
        Search<kbd className={styles.kbd}>/</kbd>
      </Link>
    </div>
  );
}
