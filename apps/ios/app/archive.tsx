import { Refused } from "@pluck/client";
import type { Item, Status } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { ItemRow } from "@/components/ItemRow";
import { Empty, usePull } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { keys, library, useArchive, useMe, usePatchItem } from "@/lib/data";
import { useRowText } from "@/lib/format";
import { kv } from "@/lib/kv";
import { font, scale, useTheme } from "@/lib/theme";

const FOLD = "fold:archive"; // the months folded away, remembered on this phone
type Row = { month: string; label: string; count: number } | Item;

// Why an Item is here, as an archive.why key and its values (the web Archive's words).
function why(item: Item, expiryDays: number | null) {
  if (item.status === "done") return ["done", {}] as const;
  switch (item.archivedReason) {
    case "expired": return expiryDays ? (["expiredAfter", { days: expiryDays }] as const) : (["expired", {}] as const);
    case "bulk": return ["bulk", {}] as const;
    case "import": return ["import", {}] as const;
    default: return ["you", {}] as const;
  }
}

// The Archive (the web Archive board, in Inbox rows): archived and done, newest move first, in months whose headers
// fold. Swipe right, or the row's action, to send one back to the Inbox; swipe left to Delete, to the Bin, which
// keeps it 30 days (the row at the top). Nothing goes from here on its own.
export default function Archive() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const format = useFormatter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const data = useArchive();
  const pull = usePull(() => data.refetch());
  const me = useMe();
  const patch = usePatchItem();
  const rowText = useRowText();
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => void kv.get<string[]>(FOLD, []).then(setFolded), []);
  const fold = (month: string) => {
    const next = folded.includes(month) ? folded.filter((m) => m !== month) : [...folded, month];
    setFolded(next);
    void kv.set(FOLD, next);
  };

  const items = data.data?.pages.flatMap((p) => p.items) ?? [];
  const rows: Row[] = [];
  let head = null as Extract<Row, { month: string }> | null;
  for (const item of items) {
    const d = new Date(item.statusChangedAt);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (head?.month === month) head.count++;
    else rows.push((head = { month, label: format.dateTime(d, { month: "long", year: "numeric" }), count: 1 }));
    if (!folded.includes(month)) rows.push(item);
  }

  const restore = (item: Item, to: Status) => {
    qc.setQueryData(keys.archive, (old: typeof data.data) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) })) } : old);
    patch.mutate({ id: item.id, patch: { status: to } });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toast(tr(`moved.${to}`), () => patch.mutate({ id: item.id, patch: { status: item.status } }));
  };

  // Delete: out of the list at once, into the bin, with Undo for as long as the toast shows.
  const remove = async (item: Item) => {
    const without = (old: typeof data.data) => (old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) })) } : old);
    qc.setQueryData(keys.archive, without);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await library.remove(item.id);
    } catch (e) {
      return toast(e instanceof Refused && e.status === 403 ? tr("archive.needsSignIn") : tr("common.failed.title"));
    }
    toast(tr("moved.deleted"), () => void library.fromBin(item.id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("common.backToLists")} onPress={() => router.back()} style={styles.back}>
          <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>{tr("tabs.lists")}</Text>
        </Pressable>
      </View>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{tr("archive.title")}</Text>
        <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21 }]}>{tr("archive.subtitle")}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => ("month" in r ? r.month : r.id)}
        style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: t.line }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl {...pull} />}
        onEndReached={() => { if (data.hasNextPage && !data.isFetchingNextPage) void data.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <Pressable accessibilityRole="button" onPress={() => router.push("/bin")}
            style={({ pressed }) => [styles.bin, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
            <Icon d={ICONS.bin} size={18} color={t.ink} width={1.5} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{tr("archive.bin")}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>{tr("archive.binLink")}</Text>
            </View>
            <Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} />
          </Pressable>
        }
        ListEmptyComponent={data.isLoading ? <ActivityIndicator accessibilityLabel={tr("common.loading")} color={t.ink2} style={{ padding: 32 }} /> : <Empty title={tr("archive.empty")} />}
        ListFooterComponent={data.isFetchingNextPage ? <ActivityIndicator color={t.ink2} style={{ padding: 24 }} /> : undefined}
        renderItem={({ item: r }) => "month" in r ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !folded.includes(r.month) }} onPress={() => fold(r.month)}
            style={({ pressed }) => [styles.group, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.rail }]}>
            <View style={{ transform: [{ rotate: folded.includes(r.month) ? "0deg" : "90deg" }] }}><Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} /></View>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 13 }]}>{r.label}</Text>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{r.count}</Text>
          </Pressable>
        ) : (
          <ItemRow
            item={r}
            meta={tr("row.siteMeta", { site: rowText(r).site, meta: (([k, v]) => tr(`archive.why.${k}`, v))(why(r, me.data?.settings.expiryDays ?? null)) })}
            onMove={(to) => restore(r, to)}
            onDelete={() => void remove(r)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 8, flexDirection: "row", alignItems: "center", minHeight: 52 },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 8 },
  head: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  bin: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  group: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
