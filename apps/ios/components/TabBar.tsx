import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";
import { font, scale, useTheme } from "@/lib/theme";
import { ICONS } from "./Glyph";

// `length` is each glyph's stroke length in its 16-unit box (measured with getTotalLength; re-measure if a glyph
// changes). The draw animates the dash offset over exactly that length.
const TABS: Record<string, { label: "inbox" | "later" | "search" | "lists"; icon: string; length: number }> = {
  index: { label: "inbox", icon: ICONS.inbox, length: 56 },
  later: { label: "later", icon: ICONS.later, length: 44 },
  search: { label: "search", icon: ICONS.search, length: 37 },
  lists: { label: "lists", icon: ICONS.listsTab, length: 52 },
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A tab's glyph draws itself in when the tab becomes the one you are on, like the share sheet's tick (SF Symbols
// calls this Draw On). Ease-out, never a bounce; with Reduce Motion on it simply appears.
function TabGlyph({ d, length, color, on }: { d: string; length: number; color: string; on: boolean }) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!on || reduced) return;
    offset.value = length;
    offset.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [on, reduced, length, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no">
      <AnimatedPath d={d} fill="none" stroke={color} strokeWidth={on ? 1.6 : 1.4} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={[length, length]} animatedProps={props} />
    </Svg>
  );
}

// The tab bar from the boards: four tabs on the rail colour, 22pt glyphs, 11pt labels that stay 11pt, like the system bar.
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const tr = useTranslations("ios.tabs");
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View style={[styles.bar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: Math.max(bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const on = state.index === i;
        const color = on ? t.actionInk : t.ink2; // the place you are on is Pluck green: forest on light, mint on dark
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr(tab.label)}
            style={styles.tab}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync();
              navigateToTab(route.key);
            }}
          >
            <TabGlyph d={tab.icon} length={tab.length} color={color} on={on} />
            <Text maxFontSizeMultiplier={scale.bar} style={[on ? font.semibold : font.regular, styles.label, { color }]}>{tr(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  tab: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 11 },
});
