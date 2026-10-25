import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

const TABS: Record<string, { label: string; icon: string }> = {
  index: { label: "Inbox", icon: ICONS.inbox },
  later: { label: "Later", icon: ICONS.later },
  search: { label: "Search", icon: ICONS.search },
  lists: { label: "Lists", icon: ICONS.listsTab },
};

// The tab bar from the boards: four tabs on the rail colour, 22pt glyphs, 11pt labels that stay 11pt, like the system bar.
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View style={[styles.bar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: Math.max(bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const on = state.index === i;
        const color = on ? t.ink : t.ink2;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            style={styles.tab}
            onPress={() => !on && navigateToTab(route.key)}
          >
            <Icon d={tab.icon} color={color} width={on ? 1.6 : 1.4} />
            <Text maxFontSizeMultiplier={scale.bar} style={[on ? font.semibold : font.regular, styles.label, { color }]}>{tab.label}</Text>
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
