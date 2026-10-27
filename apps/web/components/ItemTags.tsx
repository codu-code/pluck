"use client";

import type { Item, Tag } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TagChip } from "@/components/TagChip";
import { TagPicker } from "@/components/TagPicker";
import { library } from "@/lib/actions";
import { isTyping } from "@/lib/keys";
import styles from "./ItemTags.module.css";

// The Tags block in an item's side column (Item and ItemNote boards).
export function ItemTags({ item: initial, vocabulary }: { item: Item; vocabulary: Tag[] }) {
  const [item, setItem] = useState(initial);
  const [vocab, setVocab] = useState(vocabulary);
  const [picking, setPicking] = useState(false);
  const t = useTranslations("app.itemTags");
  const format = useFormatter();
  const byId = new Map(vocab.map((t) => [t.id, t]));
  const aiNames = item.aiTagIds.map((id) => byId.get(id)?.name).filter((n): n is string => Boolean(n));

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
    const updated = await library.setTag([item.id], tag.id, on, [item]).catch(() => null);
    if (updated?.[0]) setItem(updated[0]);
    setVocab(await library.tags().catch(() => []));
  }

  // Keeping an AI tag is a touch: saving the same set makes every tag on the item the person's.
  async function keepAll() {
    const kept = await library.edit(item.id, { tagIds: item.tagIds }).catch(() => null);
    if (kept) setItem(kept);
  }

  return (
    <div className={styles.group}>
      <span className={styles.title}>{t("title")}</span>
      <div className={styles.chips}>
        {item.tagIds.map((id) => {
          const tag = byId.get(id);
          if (!tag) return null;
          return (
            <span key={id} className={styles.chipWrap}>
              <TagChip tag={tag} ai={item.aiTagIds.includes(id)} size="aside" />
              <button type="button" className={styles.remove} aria-label={t("remove", { name: tag.name })} onClick={() => toggle(tag, false)}>
                ×
              </button>
            </span>
          );
        })}
        <button type="button" className={styles.add} onClick={() => setPicking(true)}>
          {t("add")} <kbd className={styles.kbd}>t</kbd>
        </button>
      </div>
      {aiNames.length > 0 && (
        <span className={styles.aiNote}>
          {t("byAi", { count: aiNames.length, names: format.list(aiNames.map((n) => t("quoted", { name: n })), { type: "unit" }) })}{" "}
          <button type="button" className={styles.keep} onClick={keepAll}>{t("keep")}</button>
        </span>
      )}
      {picking && (
        <TagPicker
          title={t("pickerTitle")}
          vocabulary={vocab}
          state={(id) => (item.tagIds.includes(id) ? "on" : "off")}
          onToggle={toggle}
          onCreate={async (name) => {
            const t = await library.newTag(name).catch(() => null);
            if (t) setVocab((v) => [...v.filter((x) => x.id !== t.id), t]);
            return t;
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
