import type { Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { FlatList, type ListRenderItem, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon, ICONS, KindGlyph } from "@/components/Glyph";
import { Empty } from "@/components/Screen";
import { keys, useItem, useItems, useList, useLists, usePatchItem, useTags } from "@/lib/data";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// One sheet for three picks (no board: built from the web pickers): an item's tags, an item's lists,
// and items to add to a list.
export default function Pick() {
  const { mode, id } = useLocalSearchParams<{ mode: "tags" | "lists" | "add"; id: string }>();
  return mode === "tags" ? <TagsFor itemId={id} /> : mode === "lists" ? <ListsFor itemId={id} /> : <AddTo listId={id} />;
}

// The list is the sheet's only scroll view, with the title in its header: a form sheet lays out (and drags)
// by its scroll view, and a title above it was drawn over by the rows.
function Sheet<T>({ title, top, data, keyOf, row, empty }: {
  title: string; top?: ReactNode; data: T[]; keyOf: (x: T) => string; row: ListRenderItem<T>; empty: ReactNode;
}) {
  const t = useTheme();
  return (
    <FlatList
      style={{ backgroundColor: t.ground }}
      data={data}
      keyExtractor={keyOf}
      renderItem={row}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      stickyHeaderIndices={[0]}
      ListHeaderComponent={
        <View style={{ backgroundColor: t.ground, paddingTop: 16 }}>
          <View style={styles.head}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 18 }]}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>Done</Text>
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

function TagsFor({ itemId }: { itemId: string }) {
  const t = useTheme();
  const item = useItem(itemId);
  const tags = useTags();
  const patch = usePatchItem();
  const [filter, setFilter] = useState("");
  const on = new Set(item.data?.item.tagIds ?? []);
  const shown = (tags.data ?? []).filter((x) => x.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <Sheet
      title="Tags"
      top={
        <TextInput value={filter} onChangeText={setFilter} placeholder="Search your tags" placeholderTextColor={t.ink2} autoCorrect={false} autoCapitalize="none"
          clearButtonMode="while-editing" accessibilityLabel="Search your tags"
          style={[font.regular, styles.filter, { backgroundColor: t.surface, borderColor: t.lineStrong, color: t.ink }]} />
      }
      data={shown}
      keyOf={(x) => x.id}
      row={({ item: tag }) => (
        <Row label={tag.name} on={on.has(tag.id)} onPress={() => patch.mutate({ id: itemId, patch: { tagIds: on.has(tag.id) ? [...on].filter((x) => x !== tag.id) : [...on, tag.id] } })} />
      )}
      empty={tags.isLoading ? null : filter.trim()
        ? <Empty title="No tag by that name." body="New tags start on the web, in Settings." />
        : <Empty title="No tags yet." body="Make them on the web, in Settings. Your AI can tag things too." />}
    />
  );
}

function ListsFor({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const item = useItem(itemId);
  const lists = useLists();
  const inLists = new Set((item.data?.lists ?? []).map((m) => m.list.id));
  const toggle = async (listId: string) => {
    if (inLists.has(listId)) await api(`/api/v1/lists/${listId}/items/${itemId}`, { method: "DELETE" }).catch(() => {});
    else await api(`/api/v1/lists/${listId}/items`, { json: { itemId } }).catch(() => {});
    await item.refetch();
    void qc.invalidateQueries({ queryKey: keys.lists });
    void qc.invalidateQueries({ queryKey: keys.list(listId) });
  };
  return (
    <Sheet
      title="Lists"
      data={lists.data ?? []}
      keyOf={(l) => l.id}
      row={({ item: l }) => <Row label={l.name} on={inLists.has(l.id)} onPress={() => void toggle(l.id)} />}
      empty={lists.isLoading ? null : <Empty title="No lists yet." body="Make one on the web, or ask your AI to build one." />}
    />
  );
}

function AddTo({ listId }: { listId: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const list = useList(listId);
  const inbox = useItems("inbox");
  const later = useItems("later");
  const inList = new Set((list.data?.entries ?? []).map((e) => e.item.id));
  const candidates: Item[] = [...(inbox.data?.items ?? []), ...(later.data?.items ?? [])];
  const add = async (itemId: string) => {
    if (inList.has(itemId)) return;
    await api(`/api/v1/lists/${listId}/items`, { json: { itemId } }).catch(() => {});
    await list.refetch();
    void qc.invalidateQueries({ queryKey: keys.lists });
  };
  return (
    <Sheet
      title={`Add to ${list.data?.list.name ?? "the list"}`}
      data={candidates}
      keyOf={(i) => i.id}
      row={({ item }) => <Row label={item.title} on={inList.has(item.id)} onPress={() => void add(item.id)} left={<KindGlyph kind={item.kind} color={t.ink} />} />}
      empty={inbox.isLoading || later.isLoading ? null : <Empty title="Nothing in the Inbox or Later." body="Pluck something first. It shows up here." />}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 8, paddingBottom: 8 },
  done: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  filter: { marginHorizontal: 16, marginBottom: 8, minHeight: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
