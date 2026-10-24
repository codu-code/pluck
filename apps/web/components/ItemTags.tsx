"use client";

import type { Item, Tag } from "@pluck/shared-schemas";
import { useEffect, useState } from "react";
import { TagChip } from "@/components/TagChip";
import { TagPicker } from "@/components/TagPicker";
import { isTyping } from "@/lib/keys";
import { createTagNamed, fetchTags, setTagOn } from "@/lib/tagging";
import styles from "./ItemTags.module.css";

// The Tags block in an item's side column (Item and ItemNote boards).
export function ItemTags({ item: initial, vocabulary }: { item: Item; vocabulary: Tag[] }) {
  const [item, setItem] = useState(initial);
  const [vocab, setVocab] = useState(vocabulary);
  const [picking, setPicking] = useState(false);
  const byId = new Map(vocab.map((t) => [t.id, t]));
  const aiNames = item.aiTagIds.map((id) => byId.get(id)?.name).filter(Boolean);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || window.getSelection()?.toString()) return;
      e.preventDefault();
      setPicking(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function toggle(tag: Tag, on: boolean) {
    const updated = await setTagOn([item.id], tag, on, [item]);
    if (updated?.[0]) setItem(updated[0]);
    setVocab(await fetchTags());
  }

  // Keeping an AI tag is a touch: saving the same set makes every tag on the item the person's.
  async function keepAll() {
    const res = await fetch(`/api/v1/items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagIds: item.tagIds }),
    });
    if (res.ok) setItem(((await res.json()) as { item: Item }).item);
  }

  return (
    <div className={styles.group}>
      <span className={styles.title}>Tags</span>
      <div className={styles.chips}>
        {item.tagIds.map((id) => {
          const t = byId.get(id);
          if (!t) return null;
          return (
            <span key={id} className={styles.chipWrap}>
              <TagChip tag={t} ai={item.aiTagIds.includes(id)} size="aside" />
              <button type="button" className={styles.remove} aria-label={`Remove tag ${t.name}`} onClick={() => toggle(t, false)}>
                ×
              </button>
            </span>
          );
        })}
        <button type="button" className={styles.add} onClick={() => setPicking(true)}>
          Add tag <kbd className={styles.kbd}>t</kbd>
        </button>
      </div>
      {aiNames.length > 0 && (
        <span className={styles.aiNote}>
          {aiNames.map((n) => `“${n}”`).join(", ")} {aiNames.length > 1 ? "were" : "was"} added by your AI. Touch it and it becomes yours.{" "}
          <button type="button" className={styles.keep} onClick={keepAll}>Keep</button>
        </span>
      )}
      {picking && (
        <TagPicker
          title="Tag"
          vocabulary={vocab}
          state={(id) => (item.tagIds.includes(id) ? "on" : "off")}
          onToggle={toggle}
          onCreate={async (name) => {
            const t = await createTagNamed(name);
            if (t) setVocab((v) => [...v.filter((x) => x.id !== t.id), t]);
            return t;
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
