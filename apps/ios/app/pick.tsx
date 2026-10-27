import type { Item, ItemPage } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { FlatList, type ListRenderItem, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { ItemRow } from "@/components/ItemRow";
import { Empty } from "@/components/Screen";
import { library, useItem, useItems, useList, useLists, usePatchItem, useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// One sheet for three picks (no board: built from the web pickers): an item's tags, an item's lists,
// and items to add to a list.
export default function Pick() {
  const { mode, id } = useLocalSearchParams<{ mode: "tags" | "lists" | "add"; id: string }>();
  const many = id.includes(","); // rows selected in the Inbox: their ids, comma-separated
  if (mode === "tags") return many ? <TagsForMany ids={id.split(",")} /> : <TagsFor itemId={id} />;
  if (mode === "lists") return many ? <ListsForMany ids={id.split(",")} /> : <ListsFor itemId={id} />;
  return <AddTo listId={id} />;
}

// The list is the sheet's only scroll view, with the title in its header: a form sheet lays out (and drags)
// by its scroll view, and a title above it was drawn over by the rows.
function Sheet<T>({ title, top, data, keyOf, row, empty }: {
  title: string; top?: ReactNode; data: T[]; keyOf: (x: T) => string; row: ListRenderItem<T>; empty: ReactNode;
}) {
  const t = useTheme();
  const tr = useTranslations("ios.common");
  return (
    <FlatList
      style={{ backgroundColor: t.ground }}
      data={data}
      keyExtractor={keyOf}
      renderItem={row}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets // the last rows scroll up above the keyboard
      stickyHeaderIndices={[0]}
      ListHeaderComponent={
        <View style={{ backgroundColor: t.ground, paddingTop: 16 }}>
          <View style={styles.head}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 18 }]}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("done")}</Text>
            </Pressable>
          </View>
          {top}
        </View>
      }
      ListEmptyComponent={<>{empty}</>}
    />
  );
}

function Row({ label, on, onPress, left }: { label: string; on: boolean; onPress: () => void; left?: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
      {left}
      <Text numberOfLines={2} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{label}</Text>
      {on && <Icon d={ICONS.tick} size={18} color={t.actionInk} width={2} />}
    </Pressable>
  );
}

// Search your tags, or make one from what you typed: one tap either way.
function TagsFor({ itemId }: { itemId: string }) {
  const tr = useTranslations("ios.pick");
  const item = useItem(itemId);
  const tags = useTags();
  const patch = usePatchItem();
  const [filter, setFilter] = useState("");
  const on = new Set(item.data?.item.tagIds ?? []);
  const name = filter.trim();
  const shown = (tags.data ?? []).filter((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  const fresh = name && !(tags.data ?? []).some((x) => x.name.toLowerCase() === name.toLowerCase());
  const make = async () => {
    const tag = await library.newTag(name);
    patch.mutate({ id: itemId, patch: { tagIds: [...on, tag.id] } });
    setFilter("");
  };
  return (
    <Sheet
      title={tr("tags")}
      top={<Finder value={filter} onChange={setFilter} label={tr("findTag")} make={fresh ? { label: tr("makeTag", { name }), onPress: () => void make() } : undefined} />}
      data={shown}
      keyOf={(x) => x.id}
      row={({ item: tag }) => (
        <Row label={tag.name} on={on.has(tag.id)} onPress={() => patch.mutate({ id: itemId, patch: { tagIds: on.has(tag.id) ? [...on].filter((x) => x !== tag.id) : [...on, tag.id] } })} />
      )}
      empty={tags.isLoading || fresh ? null : <Empty title={tr("noTags")} body={tr("noTagsBody")} />}
    />
  );
}

// The lists an item is in, a tap to add or take it out, and a new list from what you typed.
function ListsFor({ itemId }: { itemId: string }) {
  const tr = useTranslations("ios.pick");
  const item = useItem(itemId);
  const lists = useLists();
  const [filter, setFilter] = useState("");
  const inLists = new Set((item.data?.lists ?? []).map((m) => m.list.id));
  const name = filter.trim();
  const shown = (lists.data ?? []).filter((l) => l.name.toLowerCase().includes(name.toLowerCase()));
  const fresh = name && !(lists.data ?? []).some((l) => l.name.toLowerCase() === name.toLowerCase());
  const toggle = async (listId: string) => {
    await library.setInList([itemId], listId, !inLists.has(listId)).catch(() => {});
    await item.refetch();
  };
  const start = async () => {
    await library.newList(name, [itemId]);
    setFilter("");
    await item.refetch();
  };
  return (
    <Sheet
      title={tr("lists")}
      top={<Finder value={filter} onChange={setFilter} label={tr("findList")} make={fresh ? { label: tr("startList", { name }), onPress: () => void start() } : undefined} />}
      data={shown}
      keyOf={(l) => l.id}
      row={({ item: l }) => <Row label={l.name} on={inLists.has(l.id)} onPress={() => void toggle(l.id)} />}
      empty={lists.isLoading || fresh ? null : <Empty title={tr("noLists")} body={tr("noListsBody")} />}
    />
  );
}

// Tags for many selected rows: a tag all of them have is ticked, and a tap takes it off all of them; otherwise a
// tap puts it on all of them. Their tags come from the rows already loaded.
function TagsForMany({ ids }: { ids: string[] }) {
  const tr = useTranslations("ios.pick");
  const qc = useQueryClient();
  const tags = useTags();
  const [filter, setFilter] = useState("");
  const loaded = qc.getQueriesData<ItemPage>({ queryKey: ["items"] }).flatMap(([, page]) => page?.items ?? []);
  const [all, setAll] = useState(() => {
    const picked = ids.map((id) => loaded.find((i) => i.id === id)?.tagIds ?? []);
    return new Set((tags.data ?? []).filter((x) => picked.every((tagIds) => tagIds.includes(x.id))).map((x) => x.id));
  });
  const name = filter.trim();
  const shown = (tags.data ?? []).filter((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  const fresh = name && !(tags.data ?? []).some((x) => x.name.toLowerCase() === name.toLowerCase());
  const apply = async (tagId: string, on: boolean) => {
    setAll((cur) => { const next = new Set(cur); if (on) next.add(tagId); else next.delete(tagId); return next; });
    await library.setTag(ids, tagId, on, loaded).catch(() => {});
  };
  const make = async () => {
    const tag = await library.newTag(name);
    setFilter("");
    await apply(tag.id, true);
  };
  return (
    <Sheet
      title={tr("tagsForMany", { count: ids.length })}
      top={<Finder value={filter} onChange={setFilter} label={tr("findTag")} make={fresh ? { label: tr("makeTag", { name }), onPress: () => void make() } : undefined} />}
      data={shown}
      keyOf={(x) => x.id}
      row={({ item: tag }) => <Row label={tag.name} on={all.has(tag.id)} onPress={() => void apply(tag.id, !all.has(tag.id))} />}
      empty={tags.isLoading || fresh ? null : <Empty title={tr("noTags")} body={tr("noTagsManyBody")} />}
    />
  );
}

// Lists for many selected rows: a tap adds them all; a new list can start with them.
function ListsForMany({ ids }: { ids: string[] }) {
  const tr = useTranslations("ios.pick");
  const lists = useLists();
  const [filter, setFilter] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const name = filter.trim();
  const shown = (lists.data ?? []).filter((l) => l.name.toLowerCase().includes(name.toLowerCase()));
  const fresh = name && !(lists.data ?? []).some((l) => l.name.toLowerCase() === name.toLowerCase());
  const add = async (listId: string) => {
    if (added.has(listId)) return;
    setAdded((cur) => new Set(cur).add(listId));
    await library.setInList(ids, listId, true).catch(() => {});
  };
  const start = async () => {
    const list = await library.newList(name, ids);
    setFilter("");
    setAdded((cur) => new Set(cur).add(list.id));
  };
  return (
    <Sheet
      title={tr("addMany", { count: ids.length })}
      top={<Finder value={filter} onChange={setFilter} label={tr("findList")} make={fresh ? { label: tr("startList", { name }), onPress: () => void start() } : undefined} />}
      data={shown}
      keyOf={(l) => l.id}
      row={({ item: l }) => <Row label={l.name} on={added.has(l.id)} onPress={() => void add(l.id)} />}
      empty={lists.isLoading || fresh ? null : <Empty title={tr("noLists")} body={tr("noListsManyBody")} />}
    />
  );
}

// The field at the top of a pick, and the row that makes a new one from what is typed in it.
function Finder({ value, onChange, label, make }: { value: string; onChange: (v: string) => void; label: string; make?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <>
      <TextInput value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={t.ink2} autoCorrect={false} autoCapitalize="none"
        clearButtonMode="while-editing" accessibilityLabel={label} returnKeyType="done" onSubmitEditing={make?.onPress} selectionColor={t.accent}
        style={[font.regular, styles.filter, { backgroundColor: t.surface, borderColor: t.lineStrong, color: t.ink }]} />
      {make && (
        <Pressable accessibilityRole="button" onPress={make.onPress}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
          <Icon d={ICONS.plus} size={18} color={t.actionInk} width={1.8} />
          <Text numberOfLines={2} style={[font.medium, { flex: 1, color: t.actionInk, fontSize: 16 }]}>{make.label}</Text>
        </Pressable>
      )}
    </>
  );
}

function AddTo({ listId }: { listId: string }) {
  const t = useTheme();
  const tr = useTranslations("ios.pick");
  const list = useList(listId);
  const inbox = useItems("inbox");
  const later = useItems("later");
  const inList = new Set((list.data?.entries ?? []).map((e) => e.item.id));
  const candidates: Item[] = [...(inbox.data?.items ?? []), ...(later.data?.items ?? [])];
  const add = async (itemId: string) => {
    if (inList.has(itemId)) return;
    await library.setInList([itemId], listId, true).catch(() => {});
  };
  return (
    <Sheet
      title={list.data ? tr("addTo", { name: list.data.list.name }) : tr("addToTheList")}
      data={candidates}
      keyOf={(i) => i.id}
      // The Inbox row, so you know it when you see it; a tick once it is on the list.
      row={({ item }) => (
        <ItemRow item={item} hideWhen checked={inList.has(item.id)} onPress={() => void add(item.id)}
          trail={<View style={styles.tick}>{inList.has(item.id) && <Icon d={ICONS.tick} size={18} color={t.actionInk} width={2} />}</View>} />
      )}
      empty={inbox.isLoading || later.isLoading ? null : <Empty title={tr("nothing")} body={tr("nothingBody")} />}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 8, paddingBottom: 8 },
  done: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  filter: { marginHorizontal: 16, marginBottom: 8, minHeight: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  tick: { width: 22, alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
