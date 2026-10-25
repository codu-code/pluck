import type { List, PublicList } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ICONS } from "@/components/Glyph";
import { Empty } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { keys } from "@/lib/data";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// A List someone shared with you, See only: what its public page shows, in their order with their notes.
export default function SharedList() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = useQuery({ queryKey: ["shared", id], queryFn: () => api<PublicList>(`/api/v1/shared/${id}`) });
  const list = page.data?.list;
  const author = page.data?.author;
  const failed = (e: unknown) => Alert.alert("That did not go through", e instanceof Refused ? e.message : "Check the connection, then try again.");

  const pluckIt = async () => {
    try {
      const { list: mine } = await api<{ list: List }>("/api/v1/lists/copy", { json: { listId: id } });
      void qc.invalidateQueries({ queryKey: keys.lists });
      void qc.invalidateQueries({ queryKey: ["items"] });
      toast("Plucked. Your own copy is in Lists.");
      router.replace(`/lists/${mine.id}`);
    } catch (e) {
      failed(e);
    }
  };
  const leave = () =>
    Alert.alert("Leave this List?", "It comes off your Lists. They can share it with you again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive", onPress: async () => {
          await api(`/api/v1/shared/${id}`, { method: "DELETE" }).catch(failed);
          void qc.invalidateQueries({ queryKey: ["sharedLists"] });
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Lists" onPress={() => router.back()} style={styles.back}>
          <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>Lists</Text>
        </Pressable>
        {list && (
          <Pressable accessibilityRole="button" onPress={leave} style={styles.leave}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 15 }]}>Leave</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={page.data?.entries ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        ListHeaderComponent={list && author ? (
          <View style={[styles.head, { borderBottomColor: t.line }]}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>Shared with you by {author.name ? `${author.name} (@${author.handle})` : `@${author.handle}`} · see only</Text>
            <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{list.name}</Text>
            {list.purpose ? <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{list.purpose}</Text> : null}
          </View>
        ) : undefined}
        ListEmptyComponent={page.isLoading ? undefined : page.isError
          ? <Empty title="This List is not shared with you now." body="Its owner may have taken it back, or deleted it." />
          : <Empty title="Nothing on this List yet." />}
        renderItem={({ item: e, index }) => (
          <Pressable disabled={!e.url} onPress={() => e.url && void WebBrowser.openBrowserAsync(e.url)} accessibilityRole={e.url ? "link" : "text"}
            style={({ pressed }) => [styles.entry, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
            <Text style={[font.regular, styles.n, { color: t.ink2 }]}>{index + 1}</Text>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{e.title}</Text>
              {e.siteName ? <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{e.siteName}</Text> : null}
              {e.note ? <Text style={[font.regular, { color: t.ink, fontSize: 14, lineHeight: 19 }]}>{e.note}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      {list && (
        <Pressable onPress={() => void pluckIt()} accessibilityRole="button" accessibilityHint="Copies it into your own Pluck" style={[styles.pluck, { backgroundColor: t.brand, bottom: insets.bottom + 24 }]}>
          <Icon d={ICONS.tick} size={16} color={t.highlight} width={2} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>Pluck this list</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 8 },
  leave: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  head: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  entry: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  n: { width: 20, fontSize: 13, paddingTop: 1 },
  pluck: { position: "absolute", right: 16, minHeight: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8 },
});
