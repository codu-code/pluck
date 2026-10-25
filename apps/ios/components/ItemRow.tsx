import { initials, rowMeta, rowSite, tileIndex, when, type Item, type Status } from "@pluck/shared-schemas";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  FadeIn, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useCover } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS, KIND_NAMES, KindGlyph } from "./Glyph";

const COMMIT = 80; // how far a swipe goes before letting go moves the item

type Props = {
  item: Item;
  onMove?: (status: Status) => void;
  // Selecting (Inbox and Later): a long press starts it, then a tap adds or takes a row out.
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

// A row from the Inbox board: 72 tall (taller at large text sizes), tile, title, site and meta, kind glyph and when.
// Swipe right for Later, left to Archive (the board draws the Later swipe). Long press to select, as in Gmail.
export function ItemRow({ item, onMove, selecting = false, selected = false, onSelect }: Props) {
  const t = useTheme();
  const cover = useCover(item);
  const text = item.kind === "note" || item.kind === "todo" || item.kind === "thing";
  const ini = text ? "" : initials(item.siteName, item.url);
  const site = `${rowSite(item)} · ${rowMeta(item)}`;
  const away: Status = item.status === "later" ? "inbox" : "later";
  const pick = (mode: "tags" | "lists") => router.push({ pathname: "/pick", params: { mode, id: item.id } });
  const note = () => router.push({ pathname: "/note", params: { id: item.id } });
  const swipe = useRef<SwipeableMethods>(null);
  const held = useRef(false);

  const row = (
    <Pressable
      onPress={() => {
        if (held.current) return void (held.current = false); // the lift after a long press is not a tap
        if (selecting) onSelect?.();
        else router.push(`/items/${item.id}`);
      }}
      onLongPress={onSelect && !selecting ? () => { held.current = true; void Haptics.selectionAsync(); onSelect(); } : undefined}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={selecting ? { selected } : undefined}
      accessibilityLabel={`${item.title}, ${KIND_NAMES[item.kind]}, ${site}, ${when(item.createdAt)}${item.note ? `, note: ${item.note}` : ""}`}
      // VoiceOver has no swipe or long press: the same actions from the rotor.
      accessibilityActions={[
        ...(onMove ? [{ name: "later", label: away === "inbox" ? "Back to the Inbox" : "Later" }, { name: "archive", label: "Archive" }] : []),
        ...(onSelect ? [{ name: "select", label: selected ? "Deselect" : "Select" }] : []),
        ...(text ? [] : [{ name: "note", label: "Note" }]),
        { name: "tags", label: "Tags" }, { name: "lists", label: "Add to a List" },
      ]}
      onAccessibilityAction={(e) => {
        const a = e.nativeEvent.actionName;
        if (a === "archive") onMove?.("archived");
        else if (a === "later") onMove?.(away);
        else if (a === "select") onSelect?.();
        else if (a === "note") note();
        else pick(a === "tags" ? "tags" : "lists");
      }}
    >
      {({ pressed }) => (
        <View style={[styles.row, { backgroundColor: pressed || selected ? t.selected : t.ground, borderBottomColor: t.line }]}>
          {selecting ? (
            // The tile turns into the tick, as Gmail's avatar does.
            selected ? (
              <Animated.View entering={FadeIn.duration(120)} style={[styles.tile, { backgroundColor: t.brand }]}>
                <Icon d={ICONS.tick} size={20} color={t.onBrand} width={2.2} />
              </Animated.View>
            ) : (
              <View style={[styles.tile, styles.glyphTile, { borderColor: t.ringOff }]} />
            )
          ) : cover ? (
            <Image source={cover} style={styles.tile} accessibilityIgnoresInvertColors />
          ) : text ? (
            // A note, todo or thing has no site: its kind glyph in a dashed tile, as on the web.
            <View style={[styles.tile, styles.glyphTile, { borderColor: t.lineDashed }]}><KindGlyph kind={item.kind} size={18} color={t.ink2} /></View>
          ) : (
            <View style={[styles.tile, { backgroundColor: ini === "?" ? t.rail : t.tiles[tileIndex(item.siteName ?? item.url ?? item.id)] }]}>
              {ini !== "?" && <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, styles.ini, { color: t.ink }]}>{ini}</Text>}
            </View>
          )}
          <View style={styles.middle}>
            <Text numberOfLines={1} style={[font.semibold, styles.title, { color: t.ink }]}>{item.title}</Text>
            <Text numberOfLines={1} style={[font.regular, styles.meta, { color: t.ink2 }]}>{site}</Text>
            {item.note && !text ? <Text numberOfLines={1} style={[font.regular, styles.meta, { color: t.ink }]}>{item.note}</Text> : null}
          </View>
          <View style={styles.right}>
            <KindGlyph kind={item.kind} color={t.ink} />
            <Text style={[font.regular, styles.when, { color: t.ink2 }]}>{when(item.createdAt)}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );

  if (!onMove) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={!selecting}
      friction={2}
      leftThreshold={COMMIT}
      rightThreshold={COMMIT}
      renderLeftActions={(_, drag) => (
        <SwipeAction drag={drag} side="left" label={away === "inbox" ? "Inbox" : "Later"} icon={away === "inbox" ? ICONS.inbox : ICONS.later} bg={t.highlight} ink={t.onHighlight} />
      )}
      renderRightActions={(_, drag) => <SwipeAction drag={drag} side="right" label="Archive" icon={ICONS.archive} bg={t.archiveBg} ink={t.archiveInk} />}
      onSwipeableOpen={(direction) => {
        swipe.current?.reset(); // closed again, so the row cannot come back (Undo) with its action still showing
        onMove(direction === "left" ? "archived" : away);
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

// The colour behind a swipe and its icon: the icon grows with the drag, then squishes and settles the moment letting
// go would move the item, with a tick of haptics, as in Mail and Gmail. Reduce Motion keeps the growth, not the squish.
function SwipeAction({ drag, side, label, icon, bg, ink }: { drag: SharedValue<number>; side: "left" | "right"; label: string; icon: string; bg: string; ink: string }) {
  const still = useReducedMotion();
  const armed = useSharedValue(0);
  const squish = useSharedValue(0);
  const tick = () => void Haptics.selectionAsync();
  useAnimatedReaction(
    () => Math.abs(drag.value) >= COMMIT,
    (now, was) => {
      if (was === null || now === was) return;
      armed.value = withSpring(now ? 1 : 0, { damping: 14, stiffness: 260 });
      if (!now) return;
      if (!still) squish.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 7, stiffness: 320 }));
      runOnJS(tick)();
    },
  );
  const mark = useAnimatedStyle(() => {
    const grow = interpolate(Math.abs(drag.value), [16, COMMIT], [0.55, 1], "clamp") + armed.value * 0.12;
    return {
      opacity: interpolate(Math.abs(drag.value), [12, 40], [0, 1], "clamp"),
      transform: [{ scaleX: grow * (1 + squish.value * 0.28) }, { scaleY: grow * (1 - squish.value * 0.2) }],
    };
  });
  // Both sides' panels fill the row, one over the other: only the one the drag is heading for shows.
  const mine = useAnimatedStyle(() => ({ opacity: (side === "left" ? drag.value > 0 : drag.value < 0) ? 1 : 0 }));
  return (
    <Animated.View style={[styles.actionWrap, { backgroundColor: bg }, mine]}>
      <Animated.View style={[styles.action, side === "left" ? { left: 22 } : { right: 22 }, mark]}>
        <Icon d={icon} size={24} color={ink} width={1.7} />
        <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: ink, fontSize: 12 }]}>{label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tile: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  glyphTile: { borderWidth: 1, borderStyle: "dashed" },
  ini: { fontSize: 12 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  right: { alignItems: "flex-end", gap: 4 },
  when: { fontSize: 12 },
  actionWrap: { flex: 1, justifyContent: "center" },
  action: { position: "absolute", alignItems: "center", gap: 2, minWidth: 52 },
});
