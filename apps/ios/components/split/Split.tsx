import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import Archive from "@/app/archive";
import Bin from "@/app/bin";
import Settings from "@/app/settings";
import { font, useTheme } from "@/lib/theme";
import { OfflinePill } from "../Offline";
import { SplitContext, useColumns, type Detail, type Section } from "./context";
import { Sidebar } from "./Sidebar";

const SIDEBAR = 300;
const EDGE = 20; // how far in from the left edge a swipe brings the sidebar out
const SCRIM = { light: "rgba(21,26,19,0.28)", dark: "rgba(0,0,0,0.5)" }; // iPad-Spec, Sheets and overlays

// The iPad split view (iPad-Inbox, iPad-Spec): sidebar, list column, detail. Under 600 wide it is only its children,
// the iPhone tabs. The children keep their place in the tree either way, so resizing a Stage Manager window across
// 600 keeps the tab you are on.
export function Split({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { wide, pinned, list } = useColumns();
  const [detail, show] = useState<Detail>(null);
  const [section, go] = useState<Section>("tabs");
  const [sidebar, setSidebar] = useState(pinned);
  useEffect(() => setSidebar(pinned), [pinned]); // turning the iPad puts it back the way that orientation has it
  const value = useMemo(() => ({ detail, show, section, go, pinned, sidebar, setSidebar }), [detail, section, pinned, sidebar]);
  const middle = section === "archive" ? <Archive /> : section === "bin" ? <Bin /> : section === "settings" ? <Settings /> : null;
  return (
    <SplitContext.Provider value={wide ? value : null}>
      <View style={[styles.row, { backgroundColor: t.ground }]}>
        {wide && pinned && sidebar && <Sidebar />}
        <View style={wide ? { width: list, borderRightWidth: StyleSheet.hairlineWidth * 2, borderRightColor: t.line } : styles.fill}>
          {/* The tabs stay mounted under Archive, Bin and Settings, so going back keeps the scroll and the tab. */}
          <View style={[styles.fill, middle && styles.gone]}>{children}</View>
          {middle}
          {wide && <View pointerEvents="box-none" style={styles.pill}><OfflinePill /></View>}
          {wide && !pinned && <EdgeSwipe onOpen={() => setSidebar(true)} />}
        </View>
        {wide && <DetailColumn detail={detail} />}
        {wide && !pinned && <Overlay open={sidebar} onClose={() => setSidebar(false)} />}
      </View>
    </SplitContext.Provider>
  );
}

// The sidebar where it is not pinned: it comes over the list from the left edge, on the sheets' scrim.
function Overlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dark = useColorScheme() === "dark";
  const reduced = useReducedMotion();
  const x = useSharedValue(open ? 0 : -SIDEBAR);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) setShown(true);
    const done = (finished?: boolean) => { if (finished && !open) setShown(false); };
    x.value = reduced ? (open ? 0 : -SIDEBAR) : withTiming(open ? 0 : -SIDEBAR, { duration: 240, easing: Easing.out(Easing.cubic) }, (f) => runOnJS(done)(f));
    if (reduced && !open) setShown(false);
  }, [open, reduced, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: 1 + x.value / SIDEBAR }));
  // A swipe back to the left closes it, as the system sidebar does.
  const pan = Gesture.Pan().activeOffsetX(-12).failOffsetY([-12, 12]).onEnd((e) => { if (e.translationX < -40) runOnJS(onClose)(); });
  if (!shown) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? SCRIM.dark : SCRIM.light }, fade]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.overlay, slide]} accessibilityViewIsModal>
          <Sidebar onGo={onClose} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function EdgeSwipe({ onOpen }: { onOpen: () => void }) {
  const pan = Gesture.Pan().activeOffsetX(12).failOffsetY([-12, 12]).onEnd((e) => { if (e.translationX > 40) runOnJS(onOpen)(); });
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.edge} />
    </GestureDetector>
  );
}

function DetailColumn({ detail }: { detail: Detail }) {
  const t = useTheme();
  const tr = useTranslations("ios.ipad");
  const top = useSafeAreaInsets().top;
  if (!detail) {
    return (
      <View style={[styles.fill, styles.nothing, { paddingTop: top }]}>
        <Text style={[font.regular, { color: t.ink2, fontSize: 15, textAlign: "center" }]}>{tr("pickSomething")}</Text>
      </View>
    );
  }
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  fill: { flex: 1 },
  gone: { display: "none" },
  nothing: { alignItems: "center", justifyContent: "center", padding: 32 },
  pill: { position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" },
  overlay: { position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR, shadowColor: "#151A13", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 4, height: 0 } },
  edge: { position: "absolute", left: 0, top: 0, bottom: 0, width: EDGE },
});
