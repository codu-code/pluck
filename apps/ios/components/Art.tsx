import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, Keyframe } from "react-native-reanimated";
import { useTranslations } from "use-intl";
import { font, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

// Small drawn pieces of the product, from the IOSFirstRun and IOSInbox boards, for first run and empty states.

// Lands like the web's "Sent." stamp: a little big and askew, then settles. Reduce Motion skips it (Reanimated's default).
const stampIn = new Keyframe({
  0: { opacity: 0, transform: [{ rotate: "-6deg" }, { scale: 1.12 }] },
  100: { opacity: 1, transform: [{ rotate: "0deg" }, { scale: 1 }], easing: Easing.bezier(0.16, 1, 0.3, 1) },
}).delay(450).duration(420);

export function PluckedChip({ stamp = false }: { stamp?: boolean }) {
  const t = useTheme();
  const tr = useTranslations("ios.art");
  return (
    <Animated.View entering={stamp ? stampIn : undefined} style={[styles.chip, { backgroundColor: t.ground }]}>
      <View style={[styles.tick, { backgroundColor: t.highlight }]}><Icon d={ICONS.tick} size={14} color={t.onHighlight} width={2.2} /></View>
      <Text style={[font.bold, { color: t.ink, letterSpacing: -0.3 }]}>{tr("plucked")}</Text>
    </Animated.View>
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

// A row part-way through the swipe that sends it to Later, drawn as the swipe draws it: the Later pill in the gap the
// row leaves, and the row itself, a card, sliding off to the right.
export function SwipeToLater() {
  const t = useTheme();
  const tr = useTranslations("ios.art");
  return (
    <View style={[styles.swipe, { backgroundColor: t.artPanel }]}>
      <View style={[styles.swipePill, { backgroundColor: t.highlight }]}>
        <Icon d={ICONS.later} size={18} color={t.onHighlight} width={1.6} />
        <Text style={[font.semibold, { color: t.onHighlight, fontSize: 11 }]}>{tr("later")}</Text>
      </View>
      <View style={[styles.swipeRow, { backgroundColor: t.surface, borderColor: t.line }]}>
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
  swipe: { width: 272, borderRadius: 12, padding: 8, overflow: "hidden", flexDirection: "row", gap: 8 },
  swipePill: { width: 64, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 3 },
  swipeRow: { width: 230, height: 56, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  swipeTile: { width: 34, height: 34, borderRadius: 7 },
  bar: { height: 6, borderRadius: 3 },
});
