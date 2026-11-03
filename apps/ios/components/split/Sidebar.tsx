import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useCounts, useLists } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "../Glyph";
import { Wordmark } from "../Wordmark";
import { useSplit, type Section } from "./context";

// The tab routes the sidebar's first rows open in the list column.
const TABS = { inbox: "/", later: "/later", search: "/search", lists: "/lists" } as const;

// The iPad sidebar (iPad-Inbox, iPad-Spec): --rail, rows 40 tall, radius 10, padding 0 12, gap 12, icon 18 at 1.4,
// label 16; the place you are on on --rail-active at 600 with its icon in --action-ink; the person's Lists under
// Lists, indented 42, with their count in --ink2 13; hover on --tint. Settings sits at the bottom.
export function Sidebar({ onGo }: { onGo?: () => void }) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const top = useSafeAreaInsets().top;
  const split = useSplit();
  const path = usePathname();
  const counts = useCounts();
  const lists = useLists();
  const [listsOpen, setListsOpen] = useState(true);

  const tab = (Object.keys(TABS) as (keyof typeof TABS)[]).find((k) => TABS[k] === path);
  const here = split?.section !== "tabs" ? split?.section : tab;
  const openList = split?.detail?.kind === "list" && path === "/lists" ? split.detail.id : null;

  const goTo = useGo();
  const go = (to: Place) => {
    void Haptics.selectionAsync();
    goTo(to);
    onGo?.();
  };

  return (
    <View style={[styles.aside, { backgroundColor: t.rail, borderRightColor: t.line, paddingTop: top }]}>
      <View style={styles.bar}>
        <SidebarButton inSidebar />
        <Pressable accessibilityRole="button" accessibilityLabel={tr("add.title")} onPress={() => router.push("/add")} style={styles.barButton}>
          <Icon d={ICONS.plus} size={20} color={t.actionInk} />
        </Pressable>
      </View>
      <View style={styles.logo}><Wordmark size={26} /></View>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
        <Row icon={ICONS.inbox} label={tr("tabs.inbox")} count={counts.data?.inbox} on={here === "inbox" && !openList} onPress={() => go("inbox")} />
        <Row icon={ICONS.later} label={tr("tabs.later")} count={counts.data?.later} on={here === "later"} onPress={() => go("later")} />
        <Row icon={ICONS.listsTab} label={tr("tabs.lists")} on={here === "lists" && !openList} onPress={() => go("lists")}
          fold={{ open: listsOpen, toggle: () => setListsOpen((o) => !o), a11y: tr(listsOpen ? "ipad.hideLists" : "ipad.showLists") }} />
        {listsOpen && (lists.data ?? []).map((l) => (
          <Row key={l.id} indent label={l.name} count={l.itemCount} on={openList === l.id}
            onPress={() => { go("lists"); split?.show({ kind: "list", id: l.id }); }} />
        ))}
        <Row icon={ICONS.search} label={tr("tabs.search")} on={here === "search"} onPress={() => go("search")} />
        <View style={[styles.rule, { backgroundColor: t.line }]} />
        <Row icon={ICONS.archive} label={tr("archive.title")} on={here === "archive"} onPress={() => go("archive")} />
        <Row icon={ICONS.binSide} label={tr("archive.bin")} on={here === "bin"} onPress={() => go("bin")} />
      </ScrollView>
      <View style={{ flex: 1 }} />
      <Row icon={ICONS.settings} label={tr("settings.title")} on={here === "settings"} onPress={() => go("settings")} />
    </View>
  );
}

export type Place = keyof typeof TABS | Exclude<Section, "tabs">;

// Going to one of the sidebar's places, from the sidebar or the keyboard (⌘1 to ⌘4, ⌘F, ⌘,).
export function useGo() {
  const split = useSplit();
  return (to: Place) => {
    // Settings opens on its first group; anywhere else, a Settings group does not stay in the detail column.
    if (to === "settings") split?.show({ kind: "settings", id: "account" });
    else if (split?.detail?.kind === "settings") split.show(null);
    if (to in TABS) {
      split?.go("tabs");
      router.navigate(TABS[to as keyof typeof TABS]);
    } else split?.go(to as Exclude<Section, "tabs">);
  };
}

// Shows and hides the sidebar. In the sidebar's own bar it hides it; at the top of the list column it is there only
// while the sidebar is hidden, to bring it back.
export function SidebarButton({ inSidebar = false }: { inSidebar?: boolean }) {
  const t = useTheme();
  const tr = useTranslations("ios.ipad");
  const split = useSplit();
  if (!split || (!inSidebar && split.sidebar && split.pinned)) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr(split.sidebar ? "hideSidebar" : "showSidebar")}
      accessibilityState={{ expanded: split.sidebar }} onPress={() => split.setSidebar(!split.sidebar)} style={styles.barButton}>
      <Icon d={ICONS.sidebar} size={20} color={t.actionInk} />
    </Pressable>
  );
}

type RowProps = { icon?: string; label: string; count?: number; on: boolean; indent?: boolean; onPress: () => void; fold?: { open: boolean; toggle: () => void; a11y: string } };

function Row({ icon, label, count, on, indent, onPress, fold }: RowProps) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[styles.row, indent && { paddingLeft: 42 }, { backgroundColor: on ? t.railActive : hover ? t.tint : "transparent" }]}
    >
      {icon && <Icon d={icon} size={18} color={on ? t.actionInk : t.ink} />}
      <Text numberOfLines={1} maxFontSizeMultiplier={scale.title} style={[on ? font.semibold : font.regular, styles.label, { color: t.ink }]}>{label}</Text>
      {count !== undefined && <Text maxFontSizeMultiplier={scale.title} style={[font.regular, styles.count, { color: t.ink2 }]}>{count}</Text>}
      {fold && (
        <Pressable accessibilityRole="button" accessibilityLabel={fold.a11y} accessibilityState={{ expanded: fold.open }} onPress={fold.toggle} hitSlop={10}
          style={{ transform: [{ rotate: fold.open ? "0deg" : "-90deg" }] }}>
          <Icon d={ICONS.fold} size={14} color={t.ink2} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  aside: { width: 300, height: "100%", borderRightWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingBottom: 16 },
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  barButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginHorizontal: -8 },
  logo: { paddingTop: 4, paddingHorizontal: 12, paddingBottom: 18 },
  rows: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40, paddingHorizontal: 12, borderRadius: 10 },
  label: { flex: 1, minWidth: 0, fontSize: 16 },
  count: { fontSize: 13 },
  rule: { height: StyleSheet.hairlineWidth * 2, marginVertical: 10, marginHorizontal: 12 },
});
