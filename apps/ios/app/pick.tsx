import type { Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon, ICONS, KindGlyph } from "@/components/Glyph";
import { keys, useItem, useItems, useList, useLists, usePatchItem, useTags } from "@/lib/data";
import { api } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// One sheet for three picks (no board: built from the web pickers): an item's tags, an item's lists,
// and items to add to a list.
export default function Pick() {
  const { mode, id } = useLocalSearchParams<{ mode: "tags" | "lists" | "add"; id: string }>();
  return mode === "tags" ? <TagsFor itemId={id} /> : mode === "lists" ? <ListsFor itemId={id} /> : <AddTo listId={id} />;
}

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.ground, paddingTop: 16 }}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[font.semibold, { color: t.ink, fontSize: 18 }]}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}><Text style={[font.semibold, { color: t.brand, fontSize: 16 }]}>Done</Text></Pressable>
      </View>
      {children}
    </View>
  );
}

function Row({ label, on, onPress, left }: { label: string; on: boolean; onPress: () => void; left?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[styles.row, { borderBottomColor: t.line }]}>
      {left}
      <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{label}</Text>
      {on && <Icon d={ICONS.tick} size={18} color={t.brand} width={2} />}
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
    <Sheet title="Tags">
      <TextInput value={filter} onChangeText={setFilter} placeholder="Search your tags" placeholderTextColor={t.ink2} autoCorrect={false}
        style={[font.regular, styles.filter, { backgroundColor: t.surface, borderColor: t.lineStrong, color: t.ink }]} />
      <FlatList
        data={shown}
        keyExtractor={(x) => x.id}
        renderItem={({ item: tag }) => (
          <Row label={tag.name} on={on.has(tag.id)} onPress={() => patch.mutate({ id: itemId, patch: { tagIds: on.has(tag.id) ? [...on].filter((x) => x !== tag.id) : [...on, tag.id] } })} />
        )}
      />
    </Sheet>
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
    <Sheet title="Lists">
      <FlatList data={lists.data ?? []} keyExtractor={(l) => l.id} renderItem={({ item: l }) => <Row label={l.name} on={inLists.has(l.id)} onPress={() => void toggle(l.id)} />} />
    </Sheet>
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
    <Sheet title={`Add to ${list.data?.list.name ?? "the list"}`}>
      <FlatList
        data={candidates}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <Row label={item.title} on={inList.has(item.id)} onPress={() => void add(item.id)} left={<KindGlyph kind={item.kind} color={t.ink} />} />}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  filter: { marginHorizontal: 16, marginBottom: 8, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
