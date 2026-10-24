"use client";

import type { List } from "@pluck/shared-schemas";
import { Picker } from "./Picker";

// a: add to a list (or take out of one). A new name makes a private list.
export function ListPicker(props: {
  lists: List[];
  state: (listId: string) => "on" | "some" | "off";
  onToggle: (list: List, on: boolean) => Promise<void>;
  onCreate: (name: string) => Promise<List | null>;
  onClose: () => void;
  title: string;
}) {
  const hint = (l: List) => `${l.itemCount}`;
  return (
    <Picker
      options={props.lists.map((l) => ({ ...l, hint: hint(l) }))}
      state={props.state}
      onToggle={(o, on) => props.onToggle(o, on)}
      onCreate={async (name) => {
        const l = await props.onCreate(name);
        return l && { ...l, hint: hint(l) };
      }}
      onClose={props.onClose}
      title={props.title}
      noun="list"
      createLabel={(name) => `New list “${name}”`}
    />
  );
}
