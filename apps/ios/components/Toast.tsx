import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { font, useTheme } from "@/lib/theme";

// One line after a move, with Undo, like the web app's ("Gone. Well, archived. Undo"). The newest replaces the last.
type Toast = { id: number; text: string; undo?: () => void };
let show: (t: Toast | null) => void = () => {};
let next = 0;

export function toast(text: string, undo?: () => void) {
  show({ id: ++next, text, undo });
}

export function ToastHost() {
  const t = useTheme();
  const tr = useTranslations("ios.toast");
  const bottom = useSafeAreaInsets().bottom;
  const [current, setCurrent] = useState<Toast | null>(null);

  useEffect(() => {
    show = setCurrent;
    return () => void (show = () => {});
  }, []);
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), 4000);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  return (
    <Animated.View
      key={current.id}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      accessibilityLiveRegion="polite"
      // Above the tab bar and the reader's toolbar, which are both about 56 tall.
      style={[styles.toast, { bottom: Math.max(bottom, 8) + 64, backgroundColor: t.ink }]}
    >
      <Text accessibilityRole="alert" style={[font.medium, { flex: 1, color: t.ground, fontSize: 15 }]}>{current.text}</Text>
      {current.undo && (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            current.undo!();
            setCurrent(null);
          }}
          style={styles.undo}
        >
          <Text style={[font.semibold, { color: t.toastAction, fontSize: 15 }]}>{tr("undo")}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", left: 16, right: 16, minHeight: 48, borderRadius: 12, paddingLeft: 16, paddingRight: 6, flexDirection: "row", alignItems: "center",
    shadowColor: "#151A13", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  undo: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
});
