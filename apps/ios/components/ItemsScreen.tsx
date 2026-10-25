import { MOVED, type Item, type Status } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import { api } from "@/lib/session";
import { keys, pluck, shareExtensionCache, syncPending, toSync, useCounts, useItems, useLists, useMe, usePatchItem, useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { ShareRow, SwipeToLater } from "./Art";
import { Icon, ICONS } from "./Glyph";
import { ItemRow } from "./ItemRow";
import { Empty, TitledList } from "./Screen";
import { toast } from "./Toast";
import { setTabBarStandIn, ToolBar } from "./ToolBar";

const avatarOf = (name?: string, email?: string) =>
  ((name?.trim() || email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?");

// Inbox and Later (IOSInbox board): the count, what is waiting to sync, and the rows.
export function ItemsScreen({ status }: { status: "inbox" | "later" }) {
  const t = useTheme();
  const qc = useQueryClient();
  const items = useItems(status);
  const me = useMe();
  const tags = useTags();
  const lists = useLists();
  const patch = usePatchItem();
  const counts = useCounts();
  const [pending, setPending] = useState(0);
  const rows = items.data?.items ?? [];

  // Rows that were not here last time slide in (a pluck arriving); the first paint and rows scrolled into view do not.
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set(seen.current ? rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id) : []);
  useEffect(() => {
    if (items.data) seen.current = new Set(items.data.items.map((r) => r.id));
  }, [items.data]);

  useEffect(() => void toSync().then(setPending), [items.dataUpdatedAt]);
  useEffect(() => {
    if (tags.data && lists.data) shareExtensionCache(tags.data, lists.data);
  }, [tags.data, lists.data]);

  const move = (item: Item, to: Status) => {
    qc.setQueryData(keys.items(status), (old: typeof items.data) => (old ? { ...old, items: old.items.filter((i) => i.id !== item.id) } : old));
    seen.current?.delete(item.id);
    patch.mutate({ id: item.id, patch: { status: to } });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toast(MOVED[to], () => patch.mutate({ id: item.id, patch: { status: item.status } }));
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
    await send(to).catch(() => toast("That did not go through. Nothing moved."));
    toast(ids.length > 1 ? `${ids.length} items. ${MOVED[to]}` : MOVED[to], () => void send(status));
  };

  useEffect(() => {
    if (!picked) return setTabBarStandIn(null);
    const away: Status = status === "later" ? "inbox" : "later";
    const ids = [...picked].join(",");
    const one = chosen.length === 1 ? chosen[0]! : null;
    const more = () => {
      const options = [
        ...(one && one.url ? ["Add a note"] : []),
        ...(one ? ["Share"] : []),
        ...(chosen.every((i) => i.kind === "todo" || i.kind === "thing") ? ["Done"] : []),
        "Select all",
      ];
      ActionSheetIOS.showActionSheetWithOptions({ options: [...options, "Cancel"], cancelButtonIndex: options.length }, (i) => {
        const o = options[i];
        if (o === "Add a note") router.push({ pathname: "/note", params: { id: one!.id } });
        else if (o === "Share") void Share.share(one!.url ? { url: one!.url } : { message: one!.title });
        else if (o === "Done") void moveMany(chosen, "done");
        else if (o === "Select all") setPicked(new Set(rows.map((r) => r.id)));
      });
    };
    setTabBarStandIn(
      <ToolBar tools={[
        { label: away === "inbox" ? "Inbox" : "Later", icon: away === "inbox" ? ICONS.inbox : ICONS.later, onPress: () => void moveMany(chosen, away) },
        { label: "Tags", icon: ICONS.tag, onPress: () => router.push({ pathname: "/pick", params: { mode: "tags", id: ids } }) },
        { label: "List", icon: ICONS.lists, a11y: "Add to a List", onPress: () => router.push({ pathname: "/pick", params: { mode: "lists", id: ids } }) },
        { label: "Archive", icon: ICONS.archive, onPress: () => void moveMany(chosen, "archived") },
        { label: "More", icon: ICONS.more, onPress: more },
      ]} />,
    );
  }, [picked, items.data]); // the toolbar follows the selection and the rows it names
  useEffect(() => () => setTabBarStandIn(null), []);

  const newNote = async () => {
    const { item } = await pluck({ text: "New note", kind: "note" });
    if (item) router.push(`/items/${item.id}`);
  };

  return (
    <TitledList
      title={picked ? `${picked.size} selected` : status === "inbox" ? "Inbox" : "Later"}
      right={picked ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable accessibilityRole="button" onPress={() => setPicked(new Set(rows.map((r) => r.id)))} style={styles.textButton}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.actionInk, fontSize: 16 }]}>All</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.textButton}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {status === "inbox" && (
            <Pressable accessibilityRole="button" accessibilityLabel="New note" onPress={() => void newNote()} style={styles.headerButton}>
              <Icon d={ICONS.compose} color={t.ink} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings" style={styles.headerButton}>
            <View style={[styles.avatar, { backgroundColor: t.avatar }]}>
              <Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: t.ink, fontSize: 12 }]}>{avatarOf(me.data?.name, me.data?.email)}</Text>
            </View>
          </Pressable>
        </View>
      )}
      head={
        <View style={styles.sub}>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>
            {counts.data ? `${counts.data[status]} ${status === "inbox" ? "to triage" : "for later"}` : " "}
          </Text>
          {pending > 0 && (
            <View style={[styles.sync, { backgroundColor: t.syncBg }]}>
              <View style={[styles.syncDot, { backgroundColor: t.syncDot }]} />
              <Text style={[font.regular, { color: t.syncInk, fontSize: 12 }]}>{pending} to sync</Text>
            </View>
          )}
        </View>
      }
      layout
      data={rows}
      extraData={picked} // rows redraw when the selection changes, not only when the data does
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <Animated.View entering={fresh.has(item.id) ? FadeInUp.duration(260) : undefined} exiting={FadeOut.duration(180)}>
          <ItemRow item={item} onMove={(to) => move(item, to)} selecting={Boolean(picked)} selected={Boolean(picked?.has(item.id))} onSelect={() => select(item.id)} />
        </Animated.View>
      )}
      refreshControl={
        <RefreshControl refreshing={items.isRefetching} onRefresh={async () => { await syncPending().catch(() => 0); await items.refetch(); void counts.refetch(); setPending(await toSync()); }} />
      }
      ListEmptyComponent={
        items.isLoading ? <ActivityIndicator accessibilityLabel="Loading" color={t.ink2} style={{ padding: 32 }} /> : status === "inbox"
          ? <Empty art={<ShareRow />} title="Nothing to triage." body="Tap Share in any app, then Pluck. It lands here." />
          : <Empty art={<SwipeToLater />} title="Nothing for later." body="Swipe an item right in the Inbox and it waits here." />
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
