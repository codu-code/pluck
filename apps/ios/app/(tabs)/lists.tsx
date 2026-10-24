import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Icon, ICONS } from "@/components/Glyph";
import { Empty, TitledList } from "@/components/Screen";
import { useLists } from "@/lib/data";
import { font, useTheme } from "@/lib/theme";

// Lists (no iOS board for the index: built from the web Lists board and IOSLists).
export default function Lists() {
  const t = useTheme();
  const lists = useLists();
  return (
    <TitledList
      title="Lists"
      data={lists.data ?? []}
      keyExtractor={(l) => l.id}
      refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => void lists.refetch()} />}
      renderItem={({ item: l }) => (
        <Pressable
          onPress={() => router.push(`/lists/${l.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${l.name}, ${l.visibility === "public" ? "Public" : "Private"}, ${l.tickedCount} of ${l.itemCount} ticked`}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={2} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{l.name}</Text>
            {l.purpose ? <Text numberOfLines={2} style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{l.purpose}</Text> : undefined}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Icon d={l.visibility === "public" ? ICONS.globe : ICONS.lock} size={14} color={t.ink2} width={1.5} />
            <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{l.tickedCount} of {l.itemCount}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={lists.isLoading ? undefined : <Empty title="No lists yet." body="Make one on the web, or ask your AI to build one from what you plucked." />}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
