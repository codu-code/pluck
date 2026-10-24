"use client";

import { LINK_KINDS, type Kind } from "@pluck/shared-schemas";
import { KIND_NAMES } from "@pluck/ui";
import styles from "./KindChips.module.css";

export type KindFilter = "all" | "links" | Kind;

const CHIPS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "links", label: "Links" },
  { value: "note", label: "Notes" },
  { value: "todo", label: "Todos" },
  { value: "thing", label: "Things" },
];

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
  return (
    <div role="group" aria-label="Kind" className={styles.chips}>
      {CHIPS.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={c.value === "links" ? inLinks : value === c.value}
          className={styles.chip}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
      {inLinks && (
        <span className={styles.sub}>
          {LINK_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={value === k} className={styles.subchip} onClick={() => onChange(value === k ? "links" : k)}>
              {KIND_NAMES[k]}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
