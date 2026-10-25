import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { analyticsOn, currentConsent, loadConsent, onConsent, setConsent } from "@/lib/analytics";
import { font, scale, useTheme } from "@/lib/theme";

// The website's cookie question, asked once on the phone (there are no cookies here, so it asks plainly).
// Two buttons of the same size and weight; Settings has the same switch.
export function UsagePrompt() {
  const t = useTheme();
  const tr = useTranslations("ios.usage");
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!analyticsOn) return;
    void loadConsent().then((c) => setAsking(c === null));
    return onConsent(() => setAsking(currentConsent() === null));
  }, []);

  if (!asking) return null;
  const button = { minHeight: 48, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1.5, paddingHorizontal: 12 };
  return (
    <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.line, paddingBottom: 20 + insets.bottom }]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.bold, styles.title, { color: t.ink }]}>
        {tr.rich("title", { accent: (c) => <Text style={{ color: t.accent }}>{c}</Text> })}
      </Text>
      <Text style={[font.regular, styles.body, { color: t.ink2 }]}>
        {tr("body")}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => void setConsent("yes")} style={({ pressed }) => [button, { backgroundColor: t.brand, borderColor: t.brand, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("yes")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void setConsent("no")} style={({ pressed }) => [button, { borderColor: t.ink, backgroundColor: pressed ? t.rail : "transparent" }]}>
        <Text style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{tr("no")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: 20, paddingTop: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth * 2, shadowColor: "#151A13", shadowOpacity: 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: -8 } },
  title: { fontSize: 22, lineHeight: 26, letterSpacing: -0.44 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
});
