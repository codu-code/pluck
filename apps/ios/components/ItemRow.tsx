import { initials, rowMeta, rowSite, tileIndex, when, type Item } from "@pluck/shared-schemas";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { font, useTheme } from "@/lib/theme";
import { KindGlyph } from "./Glyph";

// A row from the Inbox board: 72 tall, tile, title, site and meta, kind glyph and when.
// Swipe right for Later, left to Archive (the board draws the Later swipe).
export function ItemRow({ item, onMove }: { item: Item; onMove?: (status: "later" | "archived" | "inbox") => void }) {
  const t = useTheme();
  const text = item.kind === "note" || item.kind === "todo" || item.kind === "thing";
  const action = (label: string, bg: string, align: "flex-start" | "flex-end") => () => (
    <View style={[styles.action, { backgroundColor: bg, alignItems: align }]}><Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{label}</Text></View>
  );
  const row = (
    <Pressable onPress={() => router.push(`/items/${item.id}`)} style={[styles.row, { backgroundColor: t.ground, borderBottomColor: t.line }]} accessibilityRole="link">
      <View style={[styles.tile, { backgroundColor: text ? t.rail : t.tiles[tileIndex(item.siteName ?? item.url ?? item.id)] }]}>
        {!text && <Text style={[font.semibold, styles.ini, { color: t.ink }]}>{initials(item.siteName, item.url)}</Text>}
      </View>
      <View style={styles.middle}>
        <Text numberOfLines={1} style={[font.semibold, styles.title, { color: t.ink }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[font.regular, styles.meta, { color: t.ink2 }]}>{rowSite(item)} · {rowMeta(item)}</Text>
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
      renderLeftActions={action(item.status === "later" ? "Inbox" : "Later", t.highlight, "flex-start")}
      renderRightActions={action("Archive", t.railActive, "flex-end")}
      onSwipeableOpen={(direction) => onMove(direction === "left" ? "archived" : item.status === "later" ? "inbox" : "later")}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { height: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tile: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ini: { fontSize: 12 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  right: { alignItems: "flex-end", gap: 4 },
  when: { fontSize: 12 },
  action: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
});
