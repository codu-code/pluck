import { Refused } from "@pluck/client";
import { BIN_DAYS, type Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ActionSheetIOS, ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { ItemRow } from "@/components/ItemRow";
import { Empty, usePull } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { keys, library, useBin } from "@/lib/data";
import { useRowText } from "@/lib/format";
import { font, scale, useTheme } from "@/lib/theme";

const DAY = 86_400_000;
const daysLeft = (item: Item) => Math.max(1, Math.ceil((new Date(item.deletedAt ?? item.updatedAt).getTime() + BIN_DAYS * DAY - Date.now()) / DAY));

// The Bin (the web Bin, in Inbox rows): what was deleted, newest first, each gone for good 30 days after. A tap asks
// what to do: Restore puts it back where it was (an archived Item to the Archive), Delete forever cannot be undone.
export default function Bin() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const data = useBin();
  const pull = usePull(() => data.refetch());
  const rowText = useRowText();
  const items = data.data?.pages.flatMap((p) => p.items) ?? [];

  const drop = (item: Item) =>
    qc.setQueryData(keys.bin, (old: typeof data.data) => (old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) })) } : old));

  const restore = async (item: Item) => {
    drop(item);
    await library.fromBin(item.id).catch(() => toast(tr("common.failed.title")));
    toast(tr("archive.outOfBin"));
  };

  const forever = async (item: Item) => {
    drop(item);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await library.forever(item.id);
      toast(tr("archive.gone"));
    } catch (e) {
      toast(e instanceof Refused && e.status === 403 ? tr("archive.needsSignIn") : tr("common.failed.title"));
    }
  };

  const ask = (item: Item) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: item.title, message: tr("archive.foreverNote"), options: [tr("archive.restore"), tr("archive.forever"), tr("common.cancel")], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => (i === 0 ? void restore(item) : i === 1 ? void forever(item) : undefined),
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("archive.title")} onPress={() => router.back()} style={styles.back}>
          <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>{tr("archive.title")}</Text>
        </Pressable>
      </View>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{tr("archive.bin")}</Text>
        <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21 }]}>{tr("archive.binSubtitle")}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: t.line }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl {...pull} />}
        onEndReached={() => { if (data.hasNextPage && !data.isFetchingNextPage) void data.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={data.isLoading ? <ActivityIndicator accessibilityLabel={tr("common.loading")} color={t.ink2} style={{ padding: 32 }} /> : <Empty title={tr("archive.binEmpty")} />}
        ListFooterComponent={data.isFetchingNextPage ? <ActivityIndicator color={t.ink2} style={{ padding: 24 }} /> : undefined}
        renderItem={({ item }) => (
          <ItemRow item={item} onPress={() => ask(item)} meta={tr("row.siteMeta", { site: rowText(item).site, meta: tr("archive.why.bin", { days: daysLeft(item) }) })} />
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
});
