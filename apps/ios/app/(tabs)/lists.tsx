import type { SharedListSummary } from "@pluck/shared-schemas";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { Empty, TitledList } from "@/components/Screen";
import { useLists } from "@/lib/data";
import { kv } from "@/lib/kv";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

const FOLD = "fold:lists:shared";

// Lists (no iOS board for the index: built from the web Lists board and IOSLists).
export default function Lists() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const lists = useLists();
  const shared = useQuery({ queryKey: ["sharedLists"], queryFn: async () => (await api<{ lists: SharedListSummary[] }>("/api/v1/shared")).lists });
  const [folded, setFolded] = useState(false);
  useEffect(() => void kv.get(FOLD, false).then(setFolded), []);
  return (
    <TitledList
      title={tr("tabs.lists")}
      data={lists.data ?? []}
      keyExtractor={(l) => l.id}
      refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => { void lists.refetch(); void shared.refetch(); }} />}
      ListFooterComponent={shared.data?.length ? (
        // Lists other people shared with you, See only.
        <View>
          {/* The header folds the section away; the phone remembers. */}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !folded }} onPress={() => { setFolded(!folded); void kv.set(FOLD, !folded); }}
            style={({ pressed }) => [styles.section, { backgroundColor: pressed ? t.selected : t.ground }]}>
            <View style={{ transform: [{ rotate: folded ? "0deg" : "90deg" }] }}><Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} /></View>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 15 }]}>{tr("lists.sharedWithYou")}</Text>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{shared.data.length}</Text>
          </Pressable>
          {!folded && shared.data.map((l) => (
            <Pressable key={l.id} onPress={() => router.push(`/shared/${l.id}`)} accessibilityRole="button"
              accessibilityLabel={tr("lists.sharedA11y", { name: l.name, owner: l.owner.name ?? l.owner.handle, count: l.itemCount })}
              style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text numberOfLines={2} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{l.name}</Text>
                <Text numberOfLines={1} style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{tr("lists.from", { owner: l.owner.name || `@${l.owner.handle}` })}</Text>
              </View>
              <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{l.itemCount}</Text>
            </Pressable>
          ))}
        </View>
      ) : undefined}
      renderItem={({ item: l }) => (
        <Pressable
          onPress={() => router.push(`/lists/${l.id}`)}
          accessibilityRole="button"
          accessibilityLabel={tr("lists.a11y", { name: l.name, visibility: l.visibility, ticked: l.tickedCount, count: l.itemCount })}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={2} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{l.name}</Text>
            {l.purpose ? <Text numberOfLines={2} style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{l.purpose}</Text> : undefined}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Icon d={l.visibility === "public" ? ICONS.globe : ICONS.lock} size={14} color={t.ink2} width={1.5} />
            <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{tr("lists.tickedOf", { ticked: l.tickedCount, count: l.itemCount })}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={lists.isLoading ? undefined : <Empty title={tr("lists.empty.title")} body={tr("lists.empty.body")} />}
    />
  );
}

const styles = StyleSheet.create({
  section: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginTop: 16, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
