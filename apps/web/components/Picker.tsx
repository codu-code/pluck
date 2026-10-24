"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./Picker.module.css";

const slug = (s: string) => s.trim().toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

export type PickerOption = { id: string; name: string; slug?: string; hint?: string | number };

type Props<O extends PickerOption> = {
  options: O[];
  // On every target item ("on"), on some of them ("some"), or none.
  state: (id: string) => "on" | "some" | "off";
  onToggle: (option: O, on: boolean) => Promise<void>;
  onCreate: (name: string) => Promise<O | null>;
  onClose: () => void;
  title: string;
  noun: string; // "tag", "list"
  createLabel: (name: string) => string;
};

// The picker behind t (tags) and a (lists): type to filter, Enter toggles, a new name offers to make one.
export function Picker<O extends PickerOption>({ options: all, state, onToggle, onCreate, onClose, title, noun, createLabel }: Props<O>) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const options = useMemo(() => {
    const s = slug(q);
    const slugOf = (o: O) => o.slug ?? slug(o.name);
    const matches = all.filter((o) => !s || slugOf(o).includes(s) || o.name.toLowerCase().includes(q.trim().toLowerCase()));
    const exact = all.some((o) => slugOf(o) === s);
    return [...matches.map((o) => ({ tag: o as O | null, create: null as string | null })), ...(s && !exact ? [{ tag: null, create: q.trim() }] : [])];
  }, [q, all]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setActive(0), [q]);

  async function choose(i: number) {
    const o = options[i];
    if (!o) return;
    if (o.tag) return onToggle(o.tag, state(o.tag.id) !== "on");
    const created = await onCreate(o.create!);
    if (created) {
      await onToggle(created, true);
      setQ("");
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={styles.panel}>
        <span className={styles.title}>{title}</span>
        <input
          ref={input}
          className={styles.input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          aria-label={noun[0]!.toUpperCase() + noun.slice(1)}
          placeholder={`Type to find or make a ${noun}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, options.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") void choose(active);
            else if (e.key === "Escape") onClose();
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
        />
        <ul id={listId} role="listbox" aria-label={`${noun}s`} aria-multiselectable="true" className={styles.list}>
          {options.map((o, i) => {
            const st = o.tag ? state(o.tag.id) : "off";
            return (
              <li
                key={o.tag?.id ?? `create-${o.create}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={st === "on"}
                data-active={i === active || undefined}
                className={styles.option}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void choose(i);
                }}
              >
                {o.tag ? (
                  <>
                    <span className={styles.box} data-state={st} aria-hidden="true">
                      {st !== "off" && (
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <path d={st === "on" ? "M2 5.2l2 2 4-4.4" : "M2.5 5h5"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={styles.name}>{o.tag.name}</span>
                    <span className={styles.count}>{o.tag.hint}</span>
                  </>
                ) : (
                  <span className={styles.create}>{createLabel(o.create!)}</span>
                )}
              </li>
            );
          })}
          {options.length === 0 && <li className={styles.empty}>No {noun}s yet. Type a name to make one.</li>}
        </ul>
        <span className={styles.hint}>Enter toggles · Esc closes</span>
      </div>
    </div>
  );
}
