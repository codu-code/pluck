import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ICONS } from "@/components/Glyph";
import { Refused } from "@pluck/client";
import { keys, useList, useMe } from "@/lib/data";
import { api, getSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// One list (IOSLists board): purpose, ticks, notes, and Add.
export default function ListScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const data = useList(id);
  const me = useMe();
  const list = data.data?.list;
  const entries = data.data?.entries ?? [];

  const tick = async (itemId: string, ticked: boolean) => {
    qc.setQueryData(keys.list(id), (old: typeof data.data) => old && { ...old, entries: old.entries.map((e) => (e.item.id === itemId ? { ...e, ticked } : e)) });
    await api(`/api/v1/lists/${id}/items/${itemId}`, { method: "PATCH", json: { ticked } }).catch(() => {});
    void qc.invalidateQueries({ queryKey: keys.list(id) });
    void qc.invalidateQueries({ queryKey: keys.lists });
  };

  const share = async () => {
    if (!list) return;
    if (list.visibility === "public") {
      const server = (await getSession())?.server ?? "https://getpluck.io";
      return Share.share({ url: `${server}/@${me.data?.handle}/${list.slug}` });
    }
    Alert.alert("Make this list public?", "Anyone with the link sees the titles, covers and your notes. Never the kept pages. You can make it private again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Make public",
        onPress: async () => {
          try {
            await api(`/api/v1/lists/${id}`, { method: "PATCH", json: { visibility: "public" } });
            await data.refetch();
          } catch (e) {
            Alert.alert("Not yet", e instanceof Refused && e.code === "handle_required" ? "Pick a handle first, in Settings on the web. It goes in the link." : "That did not work. Try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
          <Text style={[font.regular, { color: t.ink, fontSize: 15 }]}>Lists</Text>
        </Pressable>
        {list && (
          <Pressable accessibilityRole="button" onPress={() => void share()} style={[styles.shareButton, { borderColor: t.lineStrong, backgroundColor: t.surface }]}>
            <Icon d={list.visibility === "public" ? ICONS.globe : ICONS.lock} size={14} color={t.ink} width={1.5} />
            <Text style={[font.regular, { color: t.ink, fontSize: 14 }]}>{list.visibility === "public" ? "Public · Share" : "Private · Share"}</Text>
          </Pressable>
        )}
      </View>
      {list && (
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{list.name}</Text>
          {list.purpose ? <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{list.purpose}</Text> : null}
          <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{entries.filter((e) => e.ticked).length} of {entries.length} ticked</Text>
        </View>
      )}
      <FlatList
        data={entries}
        keyExtractor={(e) => e.item.id}
        style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: t.line }}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item: e }) => (
          <View style={[styles.entry, { borderBottomColor: t.line }]}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: e.ticked }} accessibilityLabel={`Tick ${e.item.title}`} onPress={() => void tick(e.item.id, !e.ticked)} style={styles.tickHit}>
              <View style={[styles.ring, e.ticked ? { borderColor: t.ink, backgroundColor: t.highlight } : { borderColor: "#9AA392" }]}>
                {e.ticked && <Icon d={ICONS.tick} size={12} color="#151A13" width={2.4} />}
              </View>
            </Pressable>
            <Pressable onPress={() => router.push(`/items/${e.item.id}`)} style={{ flex: 1, minWidth: 0, gap: 3, paddingTop: 6 }}>
              <Text style={[font.semibold, { color: e.ticked ? t.ink2 : t.ink, fontSize: 15 }]}>{e.item.title}</Text>
              {e.note ? <Text style={[font.regular, { color: t.ink2, fontSize: 14, lineHeight: 19 }]}>{e.note}{e.noteBy === "mcp" ? " · by AI" : ""}</Text> : null}
            </Pressable>
          </View>
        )}
      />
      <Pressable onPress={() => router.push({ pathname: "/pick", params: { mode: "add", id } })} accessibilityRole="button" style={[styles.add, { backgroundColor: t.brand, bottom: insets.bottom + 24 }]}>
        <Icon d={ICONS.plus} size={16} color={t.highlight} width={1.8} />
        <Text style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 8 },
  shareButton: { height: 36, marginRight: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  head: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 4, paddingTop: 6, paddingRight: 16, paddingBottom: 10, paddingLeft: 4, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  tickHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  add: { position: "absolute", right: 16, height: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8 },
});
