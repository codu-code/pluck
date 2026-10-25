import type { Tag } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Empty } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { keys, useTags } from "@/lib/data";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// Your tags, from Settings (the web's Tags section): rename one, or take it off everything. Items never go with it.
export default function Tags() {
  const t = useTheme();
  const qc = useQueryClient();
  const tags = useTags();
  const settle = () => {
    void qc.invalidateQueries({ queryKey: keys.tags });
    void qc.invalidateQueries({ queryKey: ["items"] });
  };
  const failed = (e: unknown) => Alert.alert("That did not go through", e instanceof Refused ? e.message : "Check the connection, then try again.");
  const rename = (tag: Tag) =>
    Alert.prompt("Rename the tag", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: (name?: string) => void api(`/api/v1/tags/${tag.id}`, { method: "PATCH", json: { name: name ?? "" } }).then(settle).catch(failed) },
    ], "plain-text", tag.name);
  const remove = (tag: Tag) =>
    Alert.alert(`Delete “${tag.name}”?`, `It comes off ${tag.count === 1 ? "the 1 item" : `${tag.count} items`}. The items stay.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete the tag", style: "destructive", onPress: () =>
          void api(`/api/v1/tags/${tag.id}?removeFromItems=true`, { method: "DELETE" }).then(() => { settle(); toast(`“${tag.name}” is gone. The items stay.`); }).catch(failed),
      },
    ]);
  const open = (tag: Tag) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: tag.name, options: ["Rename", "Delete the tag", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => (i === 0 ? rename(tag) : i === 1 ? remove(tag) : undefined),
    );
  return (
    <FlatList
      style={{ backgroundColor: t.ground }}
      data={tags.data ?? []}
      keyExtractor={(x) => x.id}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 18 }]}>Tags</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>Done</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item: tag }) => (
        <Pressable accessibilityRole="button" accessibilityHint="Rename or delete" onPress={() => open(tag)}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
          <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{tag.name}</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{tag.count}</Text>
        </Pressable>
      )}
      ListEmptyComponent={tags.isLoading ? undefined : <Empty title="No tags yet." body="Tag something from its long press, or the reader's Tags." />}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingLeft: 16, paddingRight: 8, paddingBottom: 8 },
  done: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
