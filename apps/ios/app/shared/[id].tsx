import { isTextKind, withReferral, type Item, type List, type PublicList } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { ItemRow } from "@/components/ItemRow";
import { Empty } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { keys, useMe } from "@/lib/data";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

type Entry = PublicList["entries"][number];
const EPOCH = new Date(0).toISOString(); // never shown (hideWhen), but the row formats it

// The Inbox row reads an Item; a shared entry has only its public fields, so the rest are the plain defaults.
const asItem = (e: Entry): Item => ({
  id: e.id, kind: e.kind, url: e.url, canonicalUrl: null, title: e.title, titleIsDerived: false, siteName: e.siteName, author: null, excerpt: e.excerpt,
  hasCover: e.hasCover, preview: e.preview, previewGuess: e.preview, facts: e.facts, status: "inbox", archivedReason: null, dueAt: null, tagIds: [], aiTagIds: [], note: null, source: "copied", wordCount: e.wordCount,
  lang: null, extraction: { state: "done", attempts: 0, lastError: null }, readingProgress: 0, inList: true, createdAt: EPOCH, updatedAt: EPOCH, lastTouchedAt: EPOCH,
  statusChangedAt: EPOCH, deletedAt: null,
});

// A List someone shared with you, See only: what its public page shows, in their order with their notes.
export default function SharedList() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const page = useQuery({ queryKey: ["shared", id], queryFn: () => api<PublicList>(`/api/v1/shared/${id}`), retry: false });
  const list = page.data?.list;
  const author = page.data?.author;
  const failed = (e: unknown) => Alert.alert(tr("common.failed.title"), e instanceof Refused ? e.message : tr("common.failed.body"));

  const pluckIt = async () => {
    try {
      const { list: mine } = await api<{ list: List }>("/api/v1/lists/copy", { json: { listId: id } });
      void qc.invalidateQueries({ queryKey: keys.lists });
      void qc.invalidateQueries({ queryKey: ["items"] });
      toast(tr("shared.copied"));
      router.replace(`/lists/${mine.id}`);
    } catch (e) {
      failed(e);
    }
  };
  const leave = () =>
    Alert.alert(tr("shared.leaveTitle"), tr("shared.leaveBody"), [
      { text: tr("common.cancel"), style: "cancel" },
      {
        text: tr("shared.leave"), style: "destructive", onPress: async () => {
          await api(`/api/v1/shared/${id}`, { method: "DELETE" }).catch(failed);
          void qc.invalidateQueries({ queryKey: ["sharedLists"] });
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("common.backToLists")} onPress={() => router.back()} style={styles.back}>
          <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>{tr("tabs.lists")}</Text>
        </Pressable>
        {list && (
          <Pressable accessibilityRole="button" onPress={leave} style={styles.leave}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{tr("shared.leave")}</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={page.data?.entries ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        ListHeaderComponent={list && author ? (
          <View style={[styles.head, { borderBottomColor: t.line }]}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{author.name ? tr("shared.byNamed", { name: author.name, handle: author.handle }) : tr("shared.by", { handle: author.handle })}</Text>
            <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{list.name}</Text>
            {list.purpose ? <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{list.purpose}</Text> : null}
          </View>
        ) : undefined}
        ListEmptyComponent={page.isLoading ? undefined : page.isError
          ? <Empty title={tr("shared.notShared.title")} body={me.data?.email ? tr("shared.notShared.body", { email: me.data.email }) : tr("shared.notShared.bodyNoEmail")} />
          : <Empty title={tr("shared.empty")} />}
        renderItem={({ item: e, index }) => (
          // The same row as your own Lists, without the marks: those are the owner's alone.
          <ItemRow
            item={asItem(e)}
            n={index + 1}
            below={e.note}
            meta={isTextKind(e.kind) ? tr(`kinds.${e.kind}`) : undefined} // no "by you": it is not
            hideWhen
            coverPath={`/api/v1/shared/${id}/items/${e.id}/cover`}
            onPress={() => e.url && void WebBrowser.openBrowserAsync(withReferral(e.url))}
          />
        )}
      />
      {list && (
        <Pressable onPress={() => void pluckIt()} accessibilityRole="button" accessibilityHint={tr("shared.pluckHint")} style={[styles.pluck, { backgroundColor: t.brand, bottom: insets.bottom + 24 }]}>
          <Icon d={ICONS.tick} size={16} color={t.highlight} width={2} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>{tr("shared.pluck")}</Text>
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
  pluck: { position: "absolute", right: 16, minHeight: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8 },
});
