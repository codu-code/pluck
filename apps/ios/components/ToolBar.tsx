import { useSyncExternalStore, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon } from "./Glyph";

export type Tool = { label: string; icon: string; onPress: () => void; a11y?: string };

// The bottom toolbar from the IOSReader board: icons over 11 pt labels on the rail. The reader has one; selecting
// rows in the Inbox puts one where the tab bar is.
export function ToolBar({ tools }: { tools: Tool[] }) {
  const t = useTheme();
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View style={[styles.bar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: Math.max(bottom, 8) }]}>
      {tools.map((x) => (
        <Pressable key={x.label} accessibilityRole="button" accessibilityLabel={x.a11y ?? x.label} onPress={x.onPress} style={styles.tool}>
          <Icon d={x.icon} color={t.ink} />
          <Text maxFontSizeMultiplier={scale.bar} style={[font.regular, { color: t.ink, fontSize: 11 }]}>{x.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// What stands in for the tab bar while a screen is selecting (the tab bar reads it).
let bar: ReactNode = null;
const listeners = new Set<() => void>();
export function setTabBarStandIn(next: ReactNode) {
  bar = next;
  listeners.forEach((fn) => fn());
}
export const useTabBarStandIn = () =>
  useSyncExternalStore((fn) => (listeners.add(fn), () => void listeners.delete(fn)), () => bar);

const styles = StyleSheet.create({
  bar: { flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  tool: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3 },
});
