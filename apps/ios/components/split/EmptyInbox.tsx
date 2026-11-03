import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { font, scale, useTheme } from "@/lib/theme";

// The empty Inbox in the iPad list column (iPad-Empty): the share sheet drawn as a card, Pluck first, and the way to
// write a note from the keyboard.
export function EmptyInbox() {
  const t = useTheme();
  const tr = useTranslations("ios.ipad.empty");
  const apps = [tr("messages"), tr("mail"), tr("notes")];
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.app}>
          <Image source={require("../../assets/icon.png")} style={styles.tile} />
          <Text maxFontSizeMultiplier={scale.badge} style={[font.regular, styles.label, { color: t.ink }]}>Pluck</Text>
        </View>
        {apps.map((a) => (
          <View key={a} style={styles.app}>
            <View style={[styles.tile, { backgroundColor: t.chip }]} />
            <Text maxFontSizeMultiplier={scale.badge} numberOfLines={1} style={[font.regular, styles.label, { color: t.ink2 }]}>{a}</Text>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={[font.semibold, { color: t.ink, fontSize: 20, textAlign: "center" }]}>{tr("title")}</Text>
      <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 22, textAlign: "center" }]}>
        {tr.rich("body", {
          key: (c) => (
            <View style={[styles.key, { borderColor: t.lineStrong }]}>
              <Text maxFontSizeMultiplier={scale.badge} style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{c}</Text>
            </View>
          ),
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 22, paddingHorizontal: 36, paddingTop: 240, paddingBottom: 80 },
  card: { flexDirection: "row", gap: 18, paddingVertical: 20, paddingHorizontal: 22, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2 },
  app: { alignItems: "center", gap: 8, width: 60 },
  tile: { width: 60, height: 60, borderRadius: 14 },
  label: { fontSize: 12 },
  // A key cap: 22 tall, radius 6, a heavier bottom edge (iPad-Empty).
  key: { minWidth: 22, height: 22, paddingHorizontal: 6, borderWidth: 1, borderBottomWidth: 2, borderRadius: 6, alignItems: "center", justifyContent: "center", transform: [{ translateY: 5 }] },
});
