"use client";

import type { List, ListMembership } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ListPicker } from "@/components/ListPicker";
import { isTyping } from "@/lib/keys";
import { createListNamed, fetchLists, membershipsOf, setInList } from "@/lib/listing";
import styles from "./ItemLists.module.css";

// "In 2 lists" in an item's side column: each list, the item's place in it and its note there.
export function ItemLists({ itemId, initial }: { itemId: string; initial: ListMembership[] }) {
  const [memberships, setMemberships] = useState(initial);
  const [picker, setPicker] = useState<List[] | null>(null);
  const t = useTranslations("app.itemLists");

  async function open() {
    setPicker(await fetchLists());
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "a" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || window.getSelection()?.toString()) return;
      e.preventDefault();
      void open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const n = memberships.length;
  return (
    <div className={styles.group}>
      <span className={styles.title}>{n ? t("inLists", { count: n }) : t("lists")}</span>
      {memberships.map((m) => (
        <Link key={m.list.id} href={`/lists/${m.list.id}`} className={styles.card}>
          <span className={styles.cardHead}>
            <b className={styles.name}>{m.list.name}</b>
            <span className={styles.meta}>{t(m.list.visibility === "public" ? "public" : "private", { place: m.place })}</span>
          </span>
          {m.note && <span className={m.noteBy === "mcp" ? `${styles.note} ${styles.ai}` : styles.note}>{m.note}</span>}
        </Link>
      ))}
      <button type="button" className={styles.add} onClick={open}>
        {t("add")} <kbd className={styles.kbd}>a</kbd>
      </button>
      {picker && (
        <ListPicker
          title={t("add")}
          lists={picker}
          state={(id) => (memberships.some((m) => m.list.id === id) ? "on" : "off")}
          onToggle={async (list, on) => {
            if (!(await setInList([itemId], list, on))) return;
            setMemberships(await membershipsOf(itemId));
            const lists = await fetchLists();
            setPicker((cur) => cur && lists); // closed while saving stays closed
          }}
          onCreate={createListNamed}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
