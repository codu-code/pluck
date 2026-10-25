import { StyleSheet, Text } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslations } from "use-intl";
import { useOnline, usePending } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

// "Offline", in clay, at the top of the tab bar while there is no connection; plucks waiting to go up join it
// ("Offline · 2 waiting") instead of a second pill. Eases in; Reanimated skips the fade under Reduce Motion.
export function OfflinePill() {
  const t = useTheme();
  const tr = useTranslations("ios.offline");
  const online = useOnline();
  const waiting = usePending().data ?? 0;
  if (online) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      style={[styles.pill, { backgroundColor: t.syncBg }]}
    >
      <Icon d={ICONS.offline} size={14} color={t.syncDot} width={1.5} />
      <Text maxFontSizeMultiplier={scale.bar} style={[font.medium, styles.label, { color: t.syncInk }]}>
        {waiting ? tr("waiting", { count: waiting }) : tr("label")}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24, paddingHorizontal: 10, borderRadius: 12, marginBottom: 2 },
  label: { fontSize: 12 },
});
