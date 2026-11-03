import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon } from "./Glyph";

export type Tool = { label: string; icon: string; onPress: () => void; a11y?: string };

// The toolbar from the IOSReader board: icons over 11 pt labels on the rail. The reader has one at the bottom;
// selecting rows in the Inbox puts one at the top, under the count.
// On iPad, in the detail column's 52 bar (iPad-Spec, Detail): icons alone, 20 in --action-ink, 36 by 36.
export function ToolBar({ tools, edge = "bottom" }: { tools: Tool[]; edge?: "top" | "bottom" | "detail" }) {
  const t = useTheme();
  const bottom = useSafeAreaInsets().bottom;
  if (edge === "detail") return <View style={styles.detail}>{tools.map((x) => <DetailTool key={x.label} tool={x} />)}</View>;
  return (
    <View style={edge === "bottom" ? [styles.bar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: Math.max(bottom, 8) }] : styles.top}>
      {tools.map((x) => (
        <Pressable key={x.label} accessibilityRole="button" accessibilityLabel={x.a11y ?? x.label} onPress={x.onPress}
          // At the top each action is its own quiet button, the full width shared evenly.
          style={({ pressed }) => [styles.tool, edge === "top" && [styles.button, { backgroundColor: pressed ? t.railActive : t.tint }]]}>
          <Icon d={x.icon} color={t.ink} />
          <Text maxFontSizeMultiplier={scale.bar} style={[font.regular, { color: t.ink, fontSize: 11 }]}>{x.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DetailTool({ tool }: { tool: Tool }) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tool.a11y ?? tool.label} onPress={tool.onPress}
      onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
      style={({ pressed }) => [styles.detailTool, (hover || pressed) && { backgroundColor: t.tint }]}>
      <Icon d={tool.icon} size={20} color={t.actionInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  detail: { flexDirection: "row", gap: 4 },
  detailTool: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  top: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  button: { minHeight: 52, borderRadius: 10 },
  tool: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3 },
});
