import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, useTheme } from "@/lib/theme";

// The large title from the boards (32/38, 600), with whatever sits on its right.
export function Header({ title, right, bold, children }: { title: string; right?: ReactNode; bold?: boolean; children?: ReactNode }) {
  const t = useTheme();
  const top = useSafeAreaInsets().top;
  return (
    <View style={{ backgroundColor: t.ground, paddingTop: top + 15 }}>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={[bold ? font.bold : font.semibold, styles.title, { color: t.ink }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[font.semibold, { color: t.ink, fontSize: 17, textAlign: "center" }]}>{title}</Text>
      {body && <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21, textAlign: "center" }]}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -0.96 },
  empty: { padding: 32, gap: 8, alignItems: "center" },
});
