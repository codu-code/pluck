import type { SharedListSummary } from "@pluck/shared-schemas";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { Empty, TitledList, usePull } from "@/components/Screen";
import { useSplit } from "@/components/split/context";
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
  const pull = usePull(() => Promise.all([lists.refetch(), shared.refetch()]));
  const [folded, setFolded] = useState(false);
  useEffect(() => void kv.get(FOLD, false).then(setFolded), []);
  const split = useSplit();
  const all = lists.data ?? [];
  return (
    <TitledList
      title={tr("tabs.lists")}
      sub={split && lists.data ? tr("ipad.listsSub", { count: all.length, shared: all.filter((l) => l.visibility === "public").length }) : undefined}
      bar={split && (
        <Pressable accessibilityRole="button" accessibilityLabel={tr("tabs.search")} onPress={() => router.navigate("/search")} hitSlop={8}>
          <Icon d={ICONS.search} size={20} color={t.actionInk} />
        </Pressable>
      )}
      // On iPad the Archive is in the sidebar.
      head={split ? undefined : 
        // The Archive sits above the Lists, like a mail app's Archive above its folders.
        <Pressable onPress={() => router.push("/archive")} accessibilityRole="button" accessibilityLabel={tr("archive.title")}
          style={({ pressed }) => [styles.archive, { backgroundColor: pressed ? t.selected : t.ground }]}>
          <Icon d={ICONS.archive} size={18} color={t.ink} width={1.5} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 16 }]}>{tr("archive.title")}</Text>
          <Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} />
        </Pressable>
      }
      data={lists.data ?? []}
      keyExtractor={(l) => l.id}
      refreshControl={<RefreshControl {...pull} />}
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
      renderItem={({ item: l }) => split ? (
        // iPad (iPad-List): a row like the Inbox's, the List open in the detail column.
        <Pressable
          onPress={() => split.show({ kind: "list", id: l.id })}
          accessibilityRole="button"
          accessibilityState={{ selected: split.detail?.id === l.id }}
          accessibilityLabel={tr("lists.a11y", { name: l.name, visibility: l.visibility, ticked: l.tickedCount, count: l.itemCount })}
          style={({ pressed }) => [styles.splitRow, { backgroundColor: split.detail?.id === l.id || pressed ? t.selected : "transparent" }]}
        >
          <View style={[styles.tile, { borderColor: t.lineDashed }]}><Icon d={ICONS.listsTab} size={16} color={t.ink} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={2} style={[font.semibold, { color: t.ink, fontSize: 15, lineHeight: 20 }]}>{l.name}</Text>
            <Text numberOfLines={1} style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{tr("ipad.listMeta", { count: l.itemCount, ticked: l.tickedCount })}</Text>
          </View>
        </Pressable>
      ) : (
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
  splitRow: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginHorizontal: 8 },
  tile: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  archive: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16 },
  section: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginTop: 16, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
