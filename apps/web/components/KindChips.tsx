"use client";

import { LINK_KINDS, type Kind } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import styles from "./KindChips.module.css";

export type KindFilter = "all" | "links" | Kind;

const CHIPS = ["all", "links", "note", "todo", "thing"] as const;

// The kinds a filter asks the API for. "Links" is expanded here; the server has no group enum.
export function kindsFor(filter: KindFilter): Kind[] | undefined {
  if (filter === "all") return undefined;
  if (filter === "links") return [...LINK_KINDS];
  return [filter];
}

export const matches = (filter: KindFilter, kind: Kind) => !kindsFor(filter) || kindsFor(filter)!.includes(kind);

// Five chips from the Main board; Links opens the four link kinds beside it.
export function KindChips({ value, onChange }: { value: KindFilter; onChange: (v: KindFilter) => void }) {
  const inLinks = value === "links" || (LINK_KINDS as readonly string[]).includes(value);
  const t = useTranslations("app.kindChips");
  const kind = useTranslations("app.kind");
  return (
    <div role="group" aria-label={t("label")} className={styles.chips}>
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={c === "links" ? inLinks : value === c}
          className={styles.chip}
          onClick={() => onChange(c)}
        >
          {t(c)}
        </button>
      ))}
      {inLinks && (
        <span className={styles.sub}>
          {LINK_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={value === k} className={styles.subchip} onClick={() => onChange(value === k ? "links" : k)}>
              {kind(k)}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
