import { Image, StyleSheet, Text, View } from "react-native";
import { font, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

// Small drawn pieces of the product, from the IOSFirstRun and IOSInbox boards, for first run and empty states.

export function PluckedChip() {
  const t = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: t.ground }]}>
      <View style={[styles.tick, { backgroundColor: t.highlight }]}><Icon d={ICONS.tick} size={14} color={t.onHighlight} width={2.2} /></View>
      <Text style={[font.bold, { color: t.ink, letterSpacing: -0.3 }]}>Plucked.</Text>
    </View>
  );
}

export function ShareRow() {
  const t = useTheme();
  return (
    <View style={[styles.share, { backgroundColor: t.artPanel }]}>
      <Image source={require("../assets/icon.png")} style={{ width: 34, height: 34, borderRadius: 8 }} />
      <View style={[styles.appTile, { backgroundColor: t.artTile }]} />
      <View style={[styles.appTile, { backgroundColor: t.artTile }]} />
    </View>
  );
}

// A row part-way through the swipe that sends it to Later.
export function SwipeToLater() {
  const t = useTheme();
  return (
    <View style={[styles.swipe, { backgroundColor: t.highlight }]}>
      <Text style={[font.semibold, styles.swipeLabel, { color: t.onHighlight }]}>Later</Text>
      <View style={[styles.swipeRow, { backgroundColor: t.ground }]}>
        <View style={[styles.swipeTile, { backgroundColor: t.tiles[0] }]} />
        <View style={{ gap: 6, flex: 1 }}>
          <View style={[styles.bar, { width: "80%", backgroundColor: t.lineStrong }]} />
          <View style={[styles.bar, { width: "50%", backgroundColor: t.line }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  share: { borderRadius: 10, padding: 10, flexDirection: "row", gap: 8 },
  appTile: { width: 34, height: 34, borderRadius: 9 },
  swipe: { width: 260, height: 56, borderRadius: 10, overflow: "hidden", justifyContent: "center" },
  swipeLabel: { position: "absolute", left: 14, fontSize: 14 },
  swipeRow: { position: "absolute", left: 76, right: -40, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  swipeTile: { width: 34, height: 34, borderRadius: 7 },
  bar: { height: 6, borderRadius: 3 },
});
