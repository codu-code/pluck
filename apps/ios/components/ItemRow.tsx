import { initials, tileIndex, type Item, type Status } from "@pluck/shared-schemas";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTranslations } from "use-intl";
import { useCover } from "@/lib/data";
import { useRowText } from "@/lib/format";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS, KindGlyph } from "./Glyph";

const COMMIT = 80; // how far a swipe goes before letting go moves the item
const GAP = 8; // between the swipe's pill and the row

type Props = {
  item: Item;
  onMove?: (status: Status) => void;
  // Selecting (Inbox and Later): a long press starts it, then a tap adds or takes a row out.
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  // In a List and the other places an Item is listed: everything below is optional, and the Inbox uses none of it.
  n?: number; // the List's order number, before the tile
  below?: ReactNode; // in place of the item's own note: a string is a note (the List's), anything else is drawn as given (a search snippet)
  meta?: string; // in place of "site · meta"
  mark?: { ticked: boolean; label: string; a11y: string; onPress: () => void }; // a List's round mark, worded by Kind
  marked?: boolean; // softens the row once marked
  onPress?: () => void; // in place of opening the item
  hideWhen?: boolean;
  coverPath?: string; // a cover from somewhere else, such as a List shared with you
  trail?: ReactNode; // after the kind glyph, such as the picker's tick
  checked?: boolean; // what the trail shows, for VoiceOver
};

// A row from the Inbox board: 72 tall (taller at large text sizes), tile, title, site and meta, kind glyph and when.
// Swipe right for Later, left to Archive (the board draws the Later swipe). Long press to select, as in Gmail.
export function ItemRow({ item, onMove, selecting = false, selected = false, onSelect, n, below, meta, mark, marked = false, onPress, hideWhen = false, coverPath, trail, checked }: Props) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const cover = useCover(item, coverPath);
  const [noCover, setNoCover] = useState(false); // offline, or gone: the tile the Inbox uses without one
  const text = item.kind === "note" || item.kind === "todo" || item.kind === "thing";
  const ini = text ? "" : initials(item.siteName, item.url);
  const words = useRowText()(item);
  const site = meta ?? words.siteMeta;
  const when = hideWhen ? "" : words.when;
  const noteText = typeof below === "string" ? below : below === undefined && !text ? item.note : null;
  const archived = item.status === "archived" || item.status === "done"; // in the Archive: the only move is back to the Inbox
  const away: Status = item.status === "inbox" ? "later" : "inbox";
  const pick = (mode: "tags" | "lists") => router.push({ pathname: "/pick", params: { mode, id: item.id } });
  const note = () => router.push({ pathname: "/note", params: { id: item.id } });
  const swipe = useRef<SwipeableMethods>(null);
  const held = useRef(false);

  const row = (
    <Pressable
      onPress={() => {
        if (held.current) return void (held.current = false); // the lift after a long press is not a tap
        if (selecting) onSelect?.();
        else if (onPress) onPress();
        else router.push(`/items/${item.id}`);
      }}
      onLongPress={onSelect && !selecting ? () => { held.current = true; void Haptics.selectionAsync(); onSelect(); } : undefined}
      delayLongPress={350}
      accessibilityRole={checked !== undefined ? "checkbox" : "button"}
      accessibilityValue={mark?.ticked ? { text: mark.label } : undefined} // "Read", "Done": the mark, said
      accessibilityState={selecting ? { selected } : mark ? { checked: mark.ticked } : checked !== undefined ? { checked } : undefined}
      accessibilityLabel={tr(noteText ? "row.a11yWithNote" : "row.a11y", { title: item.title, kind: tr(`kinds.${item.kind}`), site, when, note: noteText ?? "" })}
      // VoiceOver has no swipe or long press: the same actions from the rotor.
      accessibilityActions={[
        ...(onMove ? [{ name: "later", label: tr(away === "inbox" ? "actions.backToInbox" : "actions.later") }, ...(archived ? [] : [{ name: "archive", label: tr("actions.archive") }])] : []),
        ...(onSelect ? [{ name: "select", label: tr(selected ? "actions.deselect" : "actions.select") }] : []),
        ...(mark && !selecting ? [{ name: "mark", label: mark.a11y }] : []),
        // A row that does something else on tap (a shared List, the picker) is not the person's to tag.
        ...(onPress ? [] : [
          ...(text ? [] : [{ name: "note", label: tr("actions.note") }]),
          { name: "tags", label: tr("actions.tags") }, { name: "lists", label: tr("actions.addToList") },
        ]),
      ]}
      onAccessibilityAction={(e) => {
        const a = e.nativeEvent.actionName;
        if (a === "archive") onMove?.("archived");
        else if (a === "later") onMove?.(away);
        else if (a === "select") onSelect?.();
        else if (a === "mark") mark?.onPress();
        else if (a === "note") note();
        else if (a === "tags" || a === "lists") pick(a);
      }}
    >
      {({ pressed }) => (
        <View style={[styles.row, { backgroundColor: pressed || selected ? t.selected : t.ground, borderBottomColor: t.line }]}>
          {n !== undefined && <Text maxFontSizeMultiplier={scale.badge} style={[font.regular, styles.n, { color: t.ink2 }]}>{n}</Text>}
          {selecting ? (
            // The tile's place holds the tick ring todos use for Done: filled when chosen.
            <View style={styles.tile}>
              <View style={[styles.ring, selected ? { borderColor: t.brand, backgroundColor: t.brand } : { borderColor: t.ringOff }]}>
                {selected && <Icon d={ICONS.tick} size={13} color={t.onBrand} width={2.4} />}
              </View>
            </View>
          ) : cover && !noCover ? (
            <Image source={cover} onError={() => setNoCover(true)} style={[styles.tile, marked && styles.soft]} accessibilityIgnoresInvertColors />
          ) : text ? (
            // A note, todo or thing has no site: its kind glyph in a dashed tile, as on the web.
            <View style={[styles.tile, styles.glyphTile, { borderColor: t.lineDashed }, marked && styles.soft]}><KindGlyph kind={item.kind} size={18} color={t.ink2} /></View>
          ) : (
            <View style={[styles.tile, { backgroundColor: ini === "?" ? t.rail : t.tiles[tileIndex(item.siteName ?? item.url ?? item.id)] }, marked && styles.soft]}>
              {ini !== "?" && <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, styles.ini, { color: t.ink }]}>{ini}</Text>}
            </View>
          )}
          <View style={styles.middle}>
            <Text numberOfLines={1} style={[font.semibold, styles.title, { color: marked ? t.ink2 : t.ink }]}>{item.title}</Text>
            <Text numberOfLines={1} style={[font.regular, styles.meta, { color: t.ink2 }]}>{site}</Text>
            {below !== undefined && typeof below !== "string" ? below
              : noteText ? <Text numberOfLines={2} style={[font.regular, styles.meta, { color: marked ? t.ink2 : t.ink }]}>{noteText}</Text> : null}
          </View>
          <View style={styles.right}>
            <KindGlyph kind={item.kind} color={marked ? t.ink2 : t.ink} />
            {when ? <Text style={[font.regular, styles.when, { color: t.ink2 }]}>{when}</Text> : null}
          </View>
          {trail}
          {mark && !selecting && (
            // VoiceOver reaches it as the row's "mark" action; a finger taps the ring itself.
            <Pressable onPress={mark.onPress} hitSlop={8} importantForAccessibility="no" style={styles.mark}>
              <View style={[styles.ring, mark.ticked ? { borderColor: t.ink, backgroundColor: t.highlight } : { borderColor: t.ringOff }]}>
                {mark.ticked && <Icon d={ICONS.tick} size={12} color={t.onHighlight} width={2.4} />}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={scale.badge} style={[font.regular, styles.markLabel, { color: t.ink2 }]}>{mark.label}</Text>
            </Pressable>
          )}
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
        <SwipeAction drag={drag} side="left" label={tr(away === "inbox" ? "actions.inbox" : "actions.later")} icon={away === "inbox" ? ICONS.inbox : ICONS.later} bg={t.highlight} ink={t.onHighlight} />
      )}
      renderRightActions={archived ? undefined : (_, drag) => <SwipeAction drag={drag} side="right" label={tr("actions.archive")} icon={ICONS.archive} bg={t.archiveBg} ink={t.archiveInk} />}
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
  n: { minWidth: 16, fontSize: 12, textAlign: "right" },
  soft: { opacity: 0.55 },
  mark: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 3, marginRight: -6 },
  markLabel: { fontSize: 11 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  right: { alignItems: "flex-end", gap: 4 },
  when: { fontSize: 12 },
  actionLane: { flex: 1 },
  pill: { position: "absolute", top: 6, bottom: 6, borderRadius: 16, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  action: { alignItems: "center", gap: 2, minWidth: 48 },
});
