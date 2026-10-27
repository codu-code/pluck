import type { Tag } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { router } from "expo-router";
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Empty } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { library, useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// Your tags, from Settings (the web's Tags section): rename one, or take it off everything. Items never go with it.
export default function Tags() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const tags = useTags();
  const failed = (e: unknown) => Alert.alert(tr("common.failed.title"), e instanceof Refused ? e.message : tr("common.failed.body"));
  const rename = (tag: Tag) =>
    Alert.prompt(tr("tags.renameTitle"), undefined, [
      { text: tr("common.cancel"), style: "cancel" },
      { text: tr("common.save"), onPress: (name?: string) => void library.renameTag(tag.id, name ?? "").catch(failed) },
    ], "plain-text", tag.name);
  const remove = (tag: Tag) =>
    Alert.alert(tr("tags.deleteTitle", { name: tag.name }), tr("tags.deleteBody", { count: tag.count }), [
      { text: tr("common.cancel"), style: "cancel" },
      {
        text: tr("tags.deleteTag"), style: "destructive", onPress: () =>
          void library.deleteTag(tag.id).then(() => toast(tr("tags.deleted", { name: tag.name }))).catch(failed),
      },
    ]);
  const open = (tag: Tag) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: tag.name, options: [tr("tags.rename"), tr("tags.deleteTag"), tr("common.cancel")], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => (i === 0 ? rename(tag) : i === 1 ? remove(tag) : undefined),
    );
  return (
    <FlatList
      style={{ backgroundColor: t.ground }}
      data={tags.data ?? []}
      keyExtractor={(x) => x.id}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 18 }]}>{tr("tags.title")}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("common.done")}</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item: tag }) => (
        <Pressable accessibilityRole="button" accessibilityHint={tr("tags.hint")} onPress={() => open(tag)}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
          <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{tag.name}</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{tag.count}</Text>
        </Pressable>
      )}
      ListEmptyComponent={tags.isLoading ? undefined : <Empty title={tr("tags.empty.title")} body={tr("tags.empty.body")} />}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingLeft: 16, paddingRight: 8, paddingBottom: 8 },
  done: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
