import type { Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import styles from "./TagChip.module.css";

// Filled for yours; outlined with a clay dot for one an AI tool added and you have not touched yet.
export function TagChip({ tag, ai, size = "row", onClick, label }: { tag: Pick<Tag, "name">; ai?: boolean; size?: "row" | "aside"; onClick?: () => void; label?: string }) {
  const t = useTranslations("app.tagChip");
  const cls = `${styles.chip} ${size === "aside" ? styles.aside : ""} ${ai ? styles.ai : ""}`;
  const inner = (
    <>
      {ai && <span aria-hidden="true" className={styles.dot} />}
      {tag.name}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={ai ? t("byAi") : undefined} aria-label={label}>
      {inner}
    </button>
  ) : (
    <span className={cls} title={ai ? t("byAi") : undefined}>{inner}</span>
  );
}
