import type { Item } from "@pluck/shared-schemas";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

export const useTagNames = (item: Item) => {
  const tags = useTags().data ?? [];
  return item.tagIds.map((id) => tags.find((x) => x.id === id)?.name).filter(Boolean) as string[];
};

// An Item's tags, the same wherever an Item shows (iPad-Inbox board: 22 tall chips on --chip): its row, the reader,
// a Note. `line`: one line, the rest cut off, so a row on the iPhone keeps its height. `edit`: on the Item itself a
// tap opens the tag picker; `add` then shows a quiet Tags chip while there are none, where the toolbar's Tags is
// under the keyboard (a Note being written).
export function TagChips({ item, line = false, edit = false, add = false }: { item: Item; line?: boolean; edit?: boolean; add?: boolean }) {
  const t = useTheme();
  const tr = useTranslations("ios.actions");
  const names = useTagNames(item);
  if (!names.length && !(edit && add)) return null;
  const chips = (
    <View style={[styles.tags, line && styles.line]}>
      {names.map((n) => <Text key={n} numberOfLines={1} maxFontSizeMultiplier={scale.title} style={[font.regular, styles.tag, { backgroundColor: t.chip, color: t.ink }]}>{n}</Text>)}
      {!names.length && (
        <View style={[styles.add, { borderColor: t.lineStrong }]}>
          <Icon d={ICONS.tag} size={12} color={t.ink2} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{tr("tags")}</Text>
        </View>
      )}
    </View>
  );
  if (!edit) return chips;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[tr("tags"), ...names].join(", ")} hitSlop={10} style={{ alignSelf: "flex-start" }}
      onPress={() => router.push({ pathname: "/pick", params: { mode: "tags", id: item.id } })}>
      {chips}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  line: { flexWrap: "nowrap", overflow: "hidden" },
  tag: { height: 22, lineHeight: 22, paddingHorizontal: 8, borderRadius: 11, overflow: "hidden", fontSize: 12, flexShrink: 0 },
  add: { height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
});
