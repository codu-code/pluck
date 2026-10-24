import { initials, rowMeta, rowSite, tileIndex, when, type Item } from "@pluck/shared-schemas";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useCover } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { KIND_NAMES, KindGlyph } from "./Glyph";

// A row from the Inbox board: 72 tall (taller at large text sizes), tile, title, site and meta, kind glyph and when.
// Swipe right for Later, left to Archive (the board draws the Later swipe).
export function ItemRow({ item, onMove }: { item: Item; onMove?: (status: "later" | "archived" | "inbox") => void }) {
  const t = useTheme();
  const cover = useCover(item);
  const text = item.kind === "note" || item.kind === "todo" || item.kind === "thing";
  const ini = text ? "" : initials(item.siteName, item.url);
  const site = `${rowSite(item)} · ${rowMeta(item)}`;
  const back = item.status === "later" ? "Inbox" : "Later";
  const action = (label: string, bg: string, ink: string, align: "flex-start" | "flex-end") => () => (
    <View style={[styles.action, { backgroundColor: bg, alignItems: align }]}><Text style={[font.semibold, { color: ink, fontSize: 15 }]}>{label}</Text></View>
  );
  const row = (
    <Pressable
      onPress={() => router.push(`/items/${item.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.selected : t.ground, borderBottomColor: t.line }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${KIND_NAMES[item.kind]}, ${site}, ${when(item.createdAt)}`}
      // VoiceOver has no swipe: the same two moves, from the actions rotor.
      accessibilityActions={onMove ? [{ name: "later", label: back }, { name: "archive", label: "Archive" }] : undefined}
      onAccessibilityAction={(e) => onMove?.(e.nativeEvent.actionName === "archive" ? "archived" : item.status === "later" ? "inbox" : "later")}
    >
      {cover ? (
        <Image source={cover} style={styles.tile} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.tile, { backgroundColor: text || ini === "?" ? t.rail : t.tiles[tileIndex(item.siteName ?? item.url ?? item.id)] }]}>
          {ini !== "?" && <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, styles.ini, { color: t.ink }]}>{ini}</Text>}
        </View>
      )}
      <View style={styles.middle}>
        <Text numberOfLines={1} style={[font.semibold, styles.title, { color: t.ink }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[font.regular, styles.meta, { color: t.ink2 }]}>{site}</Text>
      </View>
      <View style={styles.right}>
        <KindGlyph kind={item.kind} color={t.ink} />
        <Text style={[font.regular, styles.when, { color: t.ink2 }]}>{when(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
  if (!onMove) return row;
  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderLeftActions={action(back, t.highlight, t.onHighlight, "flex-start")}
      renderRightActions={action("Archive", t.railActive, t.ink, "flex-end")}
      onSwipeableOpen={(direction) => onMove(direction === "left" ? "archived" : item.status === "later" ? "inbox" : "later")}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tile: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ini: { fontSize: 12 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  right: { alignItems: "flex-end", gap: 4 },
  when: { fontSize: 12 },
  action: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
});
