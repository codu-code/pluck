import type { Item, Status } from "@pluck/shared-schemas";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useTags } from "@/lib/data";
import { useRowText } from "@/lib/format";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS, KindGlyph } from "../Glyph";

type Props = {
  item: Item;
  open: boolean; // showing in the detail column
  onOpen: () => void;
  onMove?: (status: Status) => void;
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  // Search (iPad-Search): where the Item is now in place of when, the words found marked in the title, the snippet under.
  when?: string;
  mark?: string;
  below?: ReactNode;
};

// The title with each place `mark` appears in it on --highlight-wash, as the board marks a search's words.
function marked(title: string, mark: string | undefined, wash: string, ink: string): ReactNode {
  const q = mark?.trim().toLowerCase();
  if (!q) return title;
  const out: ReactNode[] = [];
  let at = 0;
  for (let i = title.toLowerCase().indexOf(q); i >= 0; i = title.toLowerCase().indexOf(q, at)) {
    out.push(title.slice(at, i), <Text key={i} style={{ backgroundColor: wash, color: ink }}>{title.slice(i, i + q.length)}</Text>);
    at = i + q.length;
  }
  out.push(title.slice(at));
  return out;
}

// A row in the iPad list column (iPad-Inbox, iPad-Spec, List column): padding 12 14, radius 12, inset 8; a 40
// dashed tile with the kind glyph; title 15/20 600, source 13 --ink2, tags as 22 tall chips. The open one sits on
// --selected; the pointer over one puts it on --tint and swaps the time for Later, Archive and Tag (30 by 30).
export function SplitRow({ item, open, onOpen, onMove, selecting = false, selected = false, onSelect, when, mark, below }: Props) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const words = useRowText()(item);
  const tags = useTags().data ?? [];
  const names = item.tagIds.map((id) => tags.find((x) => x.id === id)?.name).filter(Boolean) as string[];
  const [hover, setHover] = useState(false);
  const held = useRef(false);
  const archived = item.status === "archived" || item.status === "done";
  const away: Status = item.status === "inbox" ? "later" : "inbox";
  const pickTags = () => router.push({ pathname: "/pick", params: { mode: "tags", id: item.id } });
  const on = open || selected;

  return (
    <Pressable
      onPress={() => {
        if (held.current) return void (held.current = false);
        if (selecting) onSelect?.();
        else onOpen();
      }}
      onLongPress={onSelect && !selecting ? () => { held.current = true; void Haptics.selectionAsync(); onSelect(); } : undefined}
      delayLongPress={350}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityState={selecting ? { selected } : { selected: open }}
      accessibilityLabel={tr("row.a11y", { title: item.title, kind: tr(`kinds.${item.kind}`), site: words.siteMeta, when: words.when, note: "" })}
      accessibilityActions={[
        ...(onMove ? [{ name: "later", label: tr(away === "inbox" ? "actions.backToInbox" : "actions.later") }, ...(archived ? [] : [{ name: "archive", label: tr("actions.archive") }])] : []),
        ...(onSelect ? [{ name: "select", label: tr(selected ? "actions.deselect" : "actions.select") }] : []),
        { name: "tags", label: tr("actions.tags") },
      ]}
      onAccessibilityAction={(e) => {
        const a = e.nativeEvent.actionName;
        if (a === "later") onMove?.(away);
        else if (a === "archive") onMove?.("archived");
        else if (a === "select") onSelect?.();
        else if (a === "tags") pickTags();
      }}
      style={[styles.row, { backgroundColor: on ? t.selected : hover ? t.tint : "transparent" }]}
    >
      {selecting ? (
        <View style={styles.tile}>
          <View style={[styles.ring, selected ? { borderColor: t.brand, backgroundColor: t.brand } : { borderColor: t.ringOff }]}>
            {selected && <Icon d={ICONS.tick} size={13} color={t.onBrand} width={2.4} />}
          </View>
        </View>
      ) : (
        <View style={[styles.tile, { borderColor: t.lineDashed }]}><KindGlyph kind={item.kind} color={t.ink} /></View>
      )}
      <View style={styles.middle}>
        <View style={styles.top}>
          <Text numberOfLines={3} style={[font.semibold, styles.title, { color: t.ink }]}>{marked(item.title, mark, t.highlightWash, t.ink)}</Text>
          {hover && onMove && !selecting ? (
            <View style={styles.hoverTools}>
              <HoverTool icon={away === "inbox" ? ICONS.inbox : ICONS.later} label={tr(away === "inbox" ? "actions.backToInbox" : "actions.later")} onPress={() => onMove(away)} />
              {!archived && <HoverTool icon={ICONS.archive} label={tr("actions.archive")} onPress={() => onMove("archived")} />}
              <HoverTool icon={ICONS.tag} label={tr("actions.tags")} onPress={pickTags} />
            </View>
          ) : (
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, styles.when, { color: t.ink2 }]}>{when ?? words.when}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={[font.regular, styles.site, { color: t.ink2 }]}>{words.siteMeta}</Text>
        {below}
        {names.length > 0 && (
          <View style={styles.tags}>
            {names.map((n) => <Text key={n} maxFontSizeMultiplier={scale.title} style={[font.regular, styles.tag, { backgroundColor: t.chip, color: t.ink }]}>{n}</Text>)}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function HoverTool({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.hoverTool, { backgroundColor: t.surface, borderColor: t.lineStrong }]}>
      <Icon d={icon} size={15} color={t.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginHorizontal: 8 },
  tile: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, minWidth: 0, gap: 3 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  title: { flex: 1, fontSize: 15, lineHeight: 20 },
  when: { fontSize: 12 },
  site: { fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  tag: { height: 22, lineHeight: 22, paddingHorizontal: 8, borderRadius: 11, overflow: "hidden", fontSize: 12 },
  hoverTools: { flexDirection: "row", gap: 4 },
  hoverTool: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
