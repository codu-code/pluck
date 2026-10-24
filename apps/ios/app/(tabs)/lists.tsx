import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Icon, ICONS } from "@/components/Glyph";
import { Empty, Header } from "@/components/Screen";
import { useLists } from "@/lib/data";
import { font, useTheme } from "@/lib/theme";

// Lists (no iOS board for the index: built from the web Lists board and IOSLists).
export default function Lists() {
  const t = useTheme();
  const lists = useLists();
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <Header title="Lists" />
      <FlatList
        data={lists.data ?? []}
        keyExtractor={(l) => l.id}
        style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: t.line }}
        refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => void lists.refetch()} />}
        renderItem={({ item: l }) => (
          <Pressable onPress={() => router.push(`/lists/${l.id}`)} style={[styles.row, { borderBottomColor: t.line }]}>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={1} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{l.name}</Text>
              {l.purpose ? <Text numberOfLines={1} style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{l.purpose}</Text> : undefined}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Icon d={l.visibility === "public" ? ICONS.globe : ICONS.lock} size={14} color={t.ink2} width={1.5} />
              <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{l.tickedCount} of {l.itemCount}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={lists.isLoading ? undefined : <Empty title="No lists yet." body="Make one on the web, or ask your AI to build one from what you plucked." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
