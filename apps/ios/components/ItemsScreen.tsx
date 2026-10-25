import type { Item, Status } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslations } from "use-intl";
import { api } from "@/lib/session";
import { keys, shareExtensionCache, syncPending, useCounts, useItems, useLists, useMe, useOnline, usePatchItem, usePending, useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { ShareRow, SwipeToLater } from "./Art";
import { Icon, ICONS } from "./Glyph";
import { ItemRow } from "./ItemRow";
import { Empty, TitledList } from "./Screen";
import { toast } from "./Toast";
import { ToolBar } from "./ToolBar";

const avatarOf = (name?: string, email?: string) =>
  ((name?.trim() || email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?");

// Inbox and Later (IOSInbox board): the count, what is waiting to sync, and the rows.
export function ItemsScreen({ status }: { status: "inbox" | "later" }) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const qc = useQueryClient();
  const items = useItems(status);
  const me = useMe();
  const tags = useTags();
  const lists = useLists();
  const patch = usePatchItem();
  const counts = useCounts();
  const waiting = usePending();
  const online = useOnline();
  const pending = waiting.data ?? 0;
  const rows = items.data?.items ?? [];

  // Rows that were not here last time slide in (a pluck arriving); the first paint and rows scrolled into view do not.
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set(seen.current ? rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id) : []);
  useEffect(() => {
    if (items.data) seen.current = new Set(items.data.items.map((r) => r.id));
  }, [items.data]);

  useEffect(() => void waiting.refetch(), [items.dataUpdatedAt]);
  useEffect(() => {
    if (tags.data && lists.data) shareExtensionCache(tags.data, lists.data);
  }, [tags.data, lists.data]);

  const move = (item: Item, to: Status) => {
    qc.setQueryData(keys.items(status), (old: typeof items.data) => (old ? { ...old, items: old.items.filter((i) => i.id !== item.id) } : old));
    seen.current?.delete(item.id);
    patch.mutate({ id: item.id, patch: { status: to } });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toast(tr(`moved.${to}`), () => patch.mutate({ id: item.id, patch: { status: item.status } }));
  };

  // Selecting: a long press picks the first row; the toolbar takes the tab bar's place until Done or the last
  // row is let go.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const select = (id: string) => setPicked((cur) => {
    const next = new Set(cur ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next.size ? next : null;
  });
  // A sheet over the screen (Tags, a List) keeps the selection, so tagging can be followed by Archive; another tab ends it.
  const path = usePathname();
  useEffect(() => {
    if (["/", "/later", "/search", "/lists"].includes(path) && path !== (status === "inbox" ? "/" : "/later")) setPicked(null);
  }, [path]);
  const chosen = rows.filter((r) => picked?.has(r.id));

  const moveMany = async (moved: Item[], to: Status) => {
    const ids = moved.map((i) => i.id);
    setPicked(null);
    qc.setQueryData(keys.items(status), (old: typeof items.data) => (old ? { ...old, items: old.items.filter((i) => !ids.includes(i.id)) } : old));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const send = (s: Status) => api("/api/v1/items/batch", { json: { itemIds: ids, patch: { status: s } } }).finally(() => {
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["counts"] });
    });
    await send(to).catch(() => toast(tr("items.moveFailed")));
    toast(tr(`movedMany.${to}`, { count: ids.length }), () => void send(status));
  };

  const away: Status = status === "later" ? "inbox" : "later";
  const one = chosen.length === 1 ? chosen[0]! : null;
  const more = () => {
    const options = [
      ...(one && one.url ? ["note" as const] : []),
      ...(chosen.every((i) => i.kind === "todo" || i.kind === "thing") ? ["done" as const] : []),
      "all" as const,
    ];
    const names = { note: tr("items.addNote"), done: tr("common.done"), all: tr("items.selectAll") };
    ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => names[o]), tr("common.cancel")], cancelButtonIndex: options.length }, (i) => {
      const o = options[i];
      if (o === "note") router.push({ pathname: "/note", params: { id: one!.id } });
      else if (o === "done") void moveMany(chosen, "done");
      else if (o === "all") setPicked(new Set(rows.map((r) => r.id)));
    });
  };
  const ids = [...(picked ?? [])].join(",");
  // While selecting, the actions sit at the top, under the count.
  const actions = picked ? (
    <ToolBar edge="top" tools={[
      { label: tr(away === "inbox" ? "actions.inbox" : "actions.later"), icon: away === "inbox" ? ICONS.inbox : ICONS.later, onPress: () => void moveMany(chosen, away) },
      { label: tr("actions.tags"), icon: ICONS.tag, onPress: () => router.push({ pathname: "/pick", params: { mode: "tags", id: ids } }) },
      { label: tr("actions.list"), icon: ICONS.lists, a11y: tr("actions.addToList"), onPress: () => router.push({ pathname: "/pick", params: { mode: "lists", id: ids } }) },
      { label: tr("actions.archive"), icon: ICONS.archive, onPress: () => void moveMany(chosen, "archived") },
      { label: tr("actions.more"), icon: ICONS.more, onPress: more },
    ]} />
  ) : null;

  return (
    <TitledList
      title={picked ? tr("items.selected", { count: picked.size }) : tr(`tabs.${status}`)}
      right={picked ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable accessibilityRole="button" onPress={() => setPicked(new Set(rows.map((r) => r.id)))} style={styles.textButton}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.actionInk, fontSize: 16 }]}>{tr("items.all")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.textButton}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("common.done")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("add.title")} onPress={() => router.push("/add")} style={styles.headerButton}>
            <Icon d={ICONS.plus} color={t.ink} />
          </Pressable>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={tr("items.settings")} style={styles.headerButton}>
            <View style={[styles.avatar, { backgroundColor: t.avatar }]}>
              <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: t.ink, fontSize: 12 }]}>{avatarOf(me.data?.name, me.data?.email)}</Text>
            </View>
          </Pressable>
        </View>
      )}
      head={actions ?? (
        <View style={styles.sub}>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>
            {counts.data ? tr(status === "inbox" ? "items.toTriage" : "items.forLater", { count: counts.data[status] }) : " "}
          </Text>
          {online && pending > 0 && ( // offline, the count joins the Offline pill in the tab bar
            <View style={[styles.sync, { backgroundColor: t.syncBg }]}>
              <View style={[styles.syncDot, { backgroundColor: t.syncDot }]} />
              <Text style={[font.regular, { color: t.syncInk, fontSize: 12 }]}>{tr("items.toSync", { count: pending })}</Text>
            </View>
          )}
        </View>
      )}
      layout
      data={rows}
      extraData={picked} // rows redraw when the selection changes, not only when the data does
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        // No exit animation: inside a FlatList on the new architecture, a row leaving with one can stay drawn after it
        // has gone from the list (an archived row that would not move). Arriving rows still slide in.
        <Animated.View entering={fresh.has(item.id) ? FadeInUp.duration(260) : undefined}>
          <ItemRow item={item} onMove={(to) => move(item, to)} selecting={Boolean(picked)} selected={Boolean(picked?.has(item.id))} onSelect={() => select(item.id)} />
        </Animated.View>
      )}
      refreshControl={
        <RefreshControl refreshing={items.isRefetching} onRefresh={async () => { await syncPending().catch(() => 0); await items.refetch(); void counts.refetch(); }} />
      }
      ListEmptyComponent={
        items.isLoading ? <ActivityIndicator accessibilityLabel={tr("common.loading")} color={t.ink2} style={{ padding: 32 }} /> : status === "inbox"
          ? <Empty art={<ShareRow />} title={tr("items.empty.inbox.title")} body={tr("items.empty.inbox.body")} />
          : <Empty art={<SwipeToLater />} title={tr("items.empty.later.title")} body={tr("items.empty.later.body")} />
      }
    />
  );
}

const styles = StyleSheet.create({
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  textButton: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sub: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  sync: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24, paddingHorizontal: 10, borderRadius: 12 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
});
