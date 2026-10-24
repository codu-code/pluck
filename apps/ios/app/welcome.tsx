import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PluckedChip, ShareRow } from "@/components/Art";
import { getSession } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// First run (IOSFirstRun board): the share sheet is the whole trick.
export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 10 }]}>
      <Image source={require("../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors accessibilityLabel="Pluck" />
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.display} style={[font.bold, styles.h1, { color: t.ink }]}>You're in.{"\n"}Now pluck something.</Text>
        <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>You never need to open this app to pluck. It lives in Share, in every app.</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <View style={[styles.art, { backgroundColor: t.art }]} importantForAccessibility="no-hide-descendants"><ShareRow /></View>
          <Text style={[font.regular, styles.caption, { color: t.ink }]}><Text style={font.semibold}>1.</Text> Tap Share, then Pluck.</Text>
        </View>
        <View style={styles.cell}>
          <View style={[styles.art, { backgroundColor: t.art }]} importantForAccessibility="no-hide-descendants"><PluckedChip /></View>
          <Text style={[font.regular, styles.caption, { color: t.ink }]}><Text style={font.semibold}>2.</Text> That's it. Keep reading.</Text>
        </View>
      </View>
      <View style={{ marginTop: "auto", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 }]}
          onPress={async () => {
            await WebBrowser.openBrowserAsync(`${(await getSession())?.server ?? "https://getpluck.io"}/open-source`);
            router.replace("/");
          }}
        >
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>Try it now</Text>
        </Pressable>
        <Text style={[font.regular, { color: t.ink2, fontSize: 13, textAlign: "center" }]}>Opens a sample page in Safari. Share it to Pluck.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.quiet}>
          <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>Go to the Inbox</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  icon: { width: 56, height: 56, borderRadius: 13 },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  grid: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, gap: 8 },
  art: { height: 196, borderRadius: 14, padding: 10, justifyContent: "flex-end" },
  caption: { fontSize: 14 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
