import { useState, type ReactNode } from "react";
import { type FlatListProps, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, scale, useTheme } from "@/lib/theme";
import { useSplit } from "./split/context";
import { SidebarButton } from "./split/Sidebar";

// The large title from the boards (32/38, 600), with whatever sits on its right.
export function Header({ title, right, bold, children, inset = true }: { title: string; right?: ReactNode; bold?: boolean; children?: ReactNode; inset?: boolean }) {
  const t = useTheme();
  const top = useSafeAreaInsets().top;
  return (
    <View style={{ backgroundColor: t.ground, paddingTop: (inset ? top : 0) + 15 }}>
      <View style={styles.row}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[bold ? font.bold : font.semibold, styles.title, { color: t.ink }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

type TitledListProps<T> = Omit<FlatListProps<T>, "ListHeaderComponent" | "onScroll" | "CellRendererComponent"> & {
  title: string;
  right?: ReactNode;
  bold?: boolean;
  head?: ReactNode; // under the title, scrolls with it
  layout?: boolean; // rows close up when one leaves
  bar?: ReactNode; // iPad: the buttons on the right of the list column's 52 bar, in place of `right`
  sub?: string; // iPad: the line under the title (on iPhone it is part of `head`)
};

// A top-level list whose large title scrolls away and leaves the inline title in a bar, as UIKit's does.
export function TitledList<T>({ title, right, bold, head, layout, style, bar, sub, ...list }: TitledListProps<T>) {
  const t = useTheme();
  const top = useSafeAreaInsets().top;
  const split = useSplit();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => void (y.value = e.contentOffset.y));
  const inline = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [36, 52], [0, 1], "clamp") }));
  // iPad's list column (iPad-Inbox, iPad-Spec, List column): the 52 bar with the sidebar button and the column's
  // buttons, the title at 34/41 700, its line under, then the rows, 2 apart.
  if (split) {
    return (
      <View style={{ flex: 1, backgroundColor: t.ground, paddingTop: top }}>
        <View style={styles.columnBar}>
          <View><SidebarButton /></View>
          <View style={styles.columnTools}>{bar}</View>
        </View>
        <Animated.FlatList
          {...(list as Omit<FlatListProps<unknown>, "CellRendererComponent">)}
          itemLayoutAnimation={layout ? LinearTransition.duration(220) : undefined}
          style={style}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View>
              <View style={styles.columnHead}>
                <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.bold, styles.columnTitle, { color: t.ink }]}>{title}</Text>
                {sub ? <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 13, marginTop: 2 }]}>{sub}</Text> : null}
              </View>
              {head}
            </View>
          }
        />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <Animated.FlatList
        {...(list as Omit<FlatListProps<unknown>, "CellRendererComponent">)}
        onScroll={onScroll}
        itemLayoutAnimation={layout ? LinearTransition.duration(220) : undefined}
        scrollEventThrottle={16}
        style={[{ marginTop: top }, style]}
        ListHeaderComponent={
          <View style={{ borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: t.line }}>
            <Header title={title} right={right} bold={bold} inset={false}>{head}</Header>
          </View>
        }
      />
      {/* The inline title fades in once the large one has scrolled under it. */}
      <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.bar, { top, backgroundColor: t.ground, borderBottomColor: t.line }, inline]}>
        <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{title}</Text>
      </Animated.View>
    </View>
  );
}

export function Empty({ title, body, art }: { title: string; body?: string; art?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {art && <View style={{ marginBottom: 12 }}>{art}</View>}
      <Text style={[font.semibold, { color: t.ink, fontSize: 17, textAlign: "center" }]}>{title}</Text>
      {body && <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 }]}>{body}</Text>}
    </View>
  );
}

const Gap = () => <View style={{ height: 2 }} />;

const styles = StyleSheet.create({
  columnBar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  columnTools: { flexDirection: "row", alignItems: "center", gap: 18 },
  columnHead: { paddingHorizontal: 22, paddingBottom: 6 },
  columnTitle: { fontSize: 34, lineHeight: 41, letterSpacing: -0.68 },
  row: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -0.96, flexShrink: 1 },
  empty: { padding: 32, gap: 8, alignItems: "center" },
  bar: { position: "absolute", left: 0, right: 0, height: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});

// Pull to refresh spins for a pull only: a refetch in the background (coming back to the app, a tab) stays quiet.
export function usePull(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  return { refreshing, onRefresh: () => { setRefreshing(true); void refresh().finally(() => setRefreshing(false)); } };
}
