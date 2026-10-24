import type { Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import { keys, pluck, shareExtensionCache, syncPending, toSync, useCounts, useItems, useLists, useMe, usePatchItem, useTags } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";
import { ShareRow, SwipeToLater } from "./Art";
import { Icon, ICONS } from "./Glyph";
import { ItemRow } from "./ItemRow";
import { Empty, TitledList } from "./Screen";

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

  const move = (item: Item, to: "later" | "archived" | "inbox") => {
    qc.setQueryData(keys.items(status), (old: typeof items.data) => (old ? { ...old, items: old.items.filter((i) => i.id !== item.id) } : old));
    seen.current?.delete(item.id);
    patch.mutate({ id: item.id, patch: { status: to } });
  };

  const newNote = async () => {
    const { item } = await pluck({ text: "New note", kind: "note" });
    if (item) router.push(`/items/${item.id}`);
  };

  return (
    <TitledList
      title={status === "inbox" ? "Inbox" : "Later"}
      right={
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
      }
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
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <Animated.View entering={fresh.has(item.id) ? FadeInUp.duration(260) : undefined} exiting={FadeOut.duration(180)}>
          <ItemRow item={item} onMove={(to) => move(item, to)} />
        </Animated.View>
      )}
      refreshControl={
        <RefreshControl refreshing={items.isRefetching} onRefresh={async () => { await syncPending().catch(() => 0); await items.refetch(); void counts.refetch(); setPending(await toSync()); }} />
      }
      ListEmptyComponent={
        items.isLoading ? undefined : status === "inbox"
          ? <Empty art={<ShareRow />} title="Nothing to triage." body="Tap Share in any app, then Pluck. It lands here." />
          : <Empty art={<SwipeToLater />} title="Nothing for later." body="Swipe an item right in the Inbox and it waits here." />
      }
    />
  );
}

const styles = StyleSheet.create({
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sub: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  sync: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24, paddingHorizontal: 10, borderRadius: 12 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
});
