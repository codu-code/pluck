import { initials, rowMeta, rowSite, tileIndex, when, type Item, type Status } from "@pluck/shared-schemas";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useCover } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS, KIND_NAMES, KindGlyph } from "./Glyph";

const COMMIT = 80; // how far a swipe goes before letting go moves the item
const GAP = 8; // between the swipe's pill and the row

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
            // The tile's place holds the tick ring todos use for Done: filled when chosen.
            <View style={styles.tile}>
              <View style={[styles.ring, selected ? { borderColor: t.brand, backgroundColor: t.brand } : { borderColor: t.ringOff }]}>
                {selected && <Icon d={ICONS.tick} size={13} color={t.onBrand} width={2.4} />}
              </View>
            </View>
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

// The colour behind a swipe: a rounded pill that grows with the drag in the gap the row leaves, its icon and label
// fading in at its centre. Letting go past COMMIT moves the item, marked by a tick of haptics, not by motion.
function SwipeAction({ drag, side, label, icon, bg, ink }: { drag: SharedValue<number>; side: "left" | "right"; label: string; icon: string; bg: string; ink: string }) {
  const tick = () => void Haptics.selectionAsync();
  useAnimatedReaction(
    () => Math.abs(drag.value) >= COMMIT,
    (now, was) => {
      if (was !== null && now && !was) runOnJS(tick)();
    },
  );
  const pill = useAnimatedStyle(() => {
    const d = side === "left" ? drag.value : -drag.value; // only the side the drag is heading for shows
    return { width: Math.max(0, d - GAP), opacity: d > GAP ? 1 : 0 };
  });
  const mark = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(drag.value), [24, COMMIT * 0.75], [0, 1], "clamp") }));
  return (
    <View style={styles.actionLane}>
      <Animated.View style={[styles.pill, side === "left" ? { left: GAP / 2 } : { right: GAP / 2 }, { backgroundColor: bg }, pill]}>
        <Animated.View style={[styles.action, mark]}>
          <Icon d={icon} size={22} color={ink} width={1.6} />
          <Text numberOfLines={1} maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: ink, fontSize: 11 }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tile: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  glyphTile: { borderWidth: 1, borderStyle: "dashed" },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  ini: { fontSize: 12 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  right: { alignItems: "flex-end", gap: 4 },
  when: { fontSize: 12 },
  actionLane: { flex: 1 },
  pill: { position: "absolute", top: 6, bottom: 6, borderRadius: 16, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  action: { alignItems: "center", gap: 2, minWidth: 48 },
});
