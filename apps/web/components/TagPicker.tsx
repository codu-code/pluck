"use client";

import type { Tag } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { Picker } from "./Picker";

// t: your tag vocabulary, most used first.
export function TagPicker(props: {
  vocabulary: Tag[];
  state: (tagId: string) => "on" | "some" | "off";
  onToggle: (tag: Tag, on: boolean) => Promise<void>;
  onCreate: (name: string) => Promise<Tag | null>;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("app.picker.tag");
  const options = props.vocabulary.map((t) => ({ ...t, hint: t.count }));
  return (
    <Picker
      options={options}
      state={props.state}
      onToggle={(o, on) => props.onToggle(o, on)}
      onCreate={async (name) => {
        const t = await props.onCreate(name);
        return t && { ...t, hint: t.count };
      }}
      onClose={props.onClose}
      title={props.title}
      noun="tag"
      createLabel={(name) => t("create", { name })}
    />
  );
}
