import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ICONS } from "@/components/Glyph";
import { getSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// First run (IOSFirstRun board): the share sheet is the whole trick.
export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: t.ground, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 10 }]}>
      <Image source={require("../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={[font.bold, styles.h1, { color: t.ink }]}>You're in.{"\n"}Now pluck something.</Text>
        <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>You never need to open this app to pluck. It lives in Share, in every app.</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <View style={[styles.art, { backgroundColor: "#E4E8E0" }]}>
            <View style={[styles.shareRow, { backgroundColor: "#F2F3F1" }]}>
              <Image source={require("../assets/icon.png")} style={{ width: 34, height: 34, borderRadius: 8 }} />
              <View style={[styles.appTile, { backgroundColor: "#DFE4DA" }]} />
              <View style={[styles.appTile, { backgroundColor: "#DFE4DA" }]} />
            </View>
          </View>
          <Text style={[font.regular, styles.caption, { color: t.ink }]}><Text style={font.semibold}>1.</Text> Tap Share, then Pluck.</Text>
        </View>
        <View style={styles.cell}>
          <View style={[styles.art, { backgroundColor: "#E4E8E0" }]}>
            <View style={[styles.plucked, { backgroundColor: "#F6F8F4" }]}>
              <View style={[styles.tick, { backgroundColor: t.highlight }]}><Icon d={ICONS.tick} size={14} color="#151A13" width={2.2} /></View>
              <Text style={[font.bold, { color: "#151A13", letterSpacing: -0.3 }]}>Plucked.</Text>
            </View>
          </View>
          <Text style={[font.regular, styles.caption, { color: t.ink }]}><Text style={font.semibold}>2.</Text> That's it. Keep reading.</Text>
        </View>
      </View>
      <View style={{ marginTop: "auto", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: t.brand }]}
          onPress={async () => {
            await WebBrowser.openBrowserAsync(`${(await getSession())?.server ?? "https://getpluck.io"}/open-source`);
            router.replace("/");
          }}
        >
          <Text style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>Try it now</Text>
        </Pressable>
        <Text style={[font.regular, { color: t.ink2, fontSize: 13, textAlign: "center" }]}>Opens a sample page in Safari. Share it to Pluck.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={{ alignItems: "center", paddingVertical: 6 }}>
          <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>Go to the Inbox</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, gap: 28 },
  icon: { width: 56, height: 56, borderRadius: 13 },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  grid: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, gap: 8 },
  art: { height: 196, borderRadius: 14, padding: 10, justifyContent: "flex-end" },
  shareRow: { borderRadius: 10, padding: 10, flexDirection: "row", gap: 8 },
  appTile: { width: 34, height: 34, borderRadius: 9 },
  plucked: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  caption: { fontSize: 14 },
  primary: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
