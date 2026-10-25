import { listMarkWord, markWord, type List, type ListEntry } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { ItemRow } from "@/components/ItemRow";
import { Empty } from "@/components/Screen";
import { toast } from "@/components/Toast";
import { ToolBar } from "@/components/ToolBar";
import { keys, useList } from "@/lib/data";
import { kv } from "@/lib/kv";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

type Row = { e: ListEntry; n: number } | "head";
type Data = { list: List; entries: ListEntry[] };

// One list (IOSLists board), in Inbox rows: unmarked in order, then the marked ones under a header that folds.
// Each row has its order number, its List note and a round mark worded by Kind. Long press to select.
export default function ListScreen() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const data = useList(id);
  const list = data.data?.list;
  const entries = data.data?.entries ?? [];
  const foldKey = `fold:list:${id}:marked`;
  const [folded, setFolded] = useState(false);
  useEffect(() => void kv.get(foldKey, false).then(setFolded), [foldKey]);
  const fold = () => {
    setFolded(!folded);
    void kv.set(foldKey, !folded);
  };
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const select = (itemId: string) => setPicked((cur) => {
    const next = new Set(cur ?? []);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    return next.size ? next : null;
  });

  const numbered = entries.map((e, i) => ({ e, n: i + 1 }));
  const marked = numbered.filter((r) => r.e.ticked);
  const rows: Row[] = [...numbered.filter((r) => !r.e.ticked), ...(marked.length ? ["head" as const] : []), ...(folded ? [] : marked)];
  const word = listMarkWord(entries.map((e) => e.item.kind));
  const chosen = entries.filter((e) => picked?.has(e.item.id));

  const edit = (fn: (entries: ListEntry[]) => ListEntry[]) => qc.setQueryData<Data>(keys.list(id), (old) => old && { ...old, entries: fn(old.entries) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.list(id) });
    void qc.invalidateQueries({ queryKey: keys.lists });
    void qc.invalidateQueries({ queryKey: ["items"] }); // a Todo marked here is Done there
    void qc.invalidateQueries({ queryKey: ["counts"] });
  };
  const failed = () => toast(tr("common.failed.title"));

  const mark = async (ids: string[], ticked: boolean) => {
    edit((es) => es.map((e) => (ids.includes(e.item.id) ? { ...e, ticked } : e)));
    void Haptics.selectionAsync();
    await (ids.length === 1
      ? api(`/api/v1/lists/${id}/items/${ids[0]}`, { method: "PATCH", json: { ticked } })
      : api(`/api/v1/lists/${id}/items`, { method: "PATCH", json: { itemIds: ids, ticked } })
    ).catch(failed);
    refresh();
  };

  const toTop = async () => {
    const order = [...chosen, ...entries.filter((e) => !picked?.has(e.item.id))];
    setPicked(null);
    edit(() => order);
    await api(`/api/v1/lists/${id}/reorder`, { json: { itemIds: order.map((e) => e.item.id) } }).catch(failed);
    refresh();
  };

  const takeOut = async () => {
    const gone = chosen;
    setPicked(null);
    edit((es) => es.filter((e) => !gone.includes(e)));
    for (const e of gone) await api(`/api/v1/lists/${id}/items/${e.item.id}`, { method: "DELETE" }).catch(failed);
    refresh();
    toast(tr("list.takenOut", { count: gone.length }), async () => {
      for (const e of gone) await api(`/api/v1/lists/${id}/items`, { json: { itemId: e.item.id, position: e.position, note: e.note } }).catch(failed);
      refresh();
    });
  };

  const share = () => router.push({ pathname: "/share", params: { id } });
  const chosenWord = listMarkWord(chosen.map((e) => e.item.kind));

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {picked ? (
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, styles.count, { color: t.ink }]}>{tr("items.selected", { count: picked.size })}</Text>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={tr("common.backToLists")} onPress={() => router.back()} style={styles.back}>
            <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>{tr("tabs.lists")}</Text>
          </Pressable>
        )}
        {picked ? (
          <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.textButton}>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("common.done")}</Text>
          </Pressable>
        ) : list && (
          <Pressable accessibilityRole="button" onPress={share} hitSlop={{ top: 4, bottom: 4 }} style={[styles.shareButton, { borderColor: t.lineStrong, backgroundColor: t.surface }]}>
            <Icon d={list.visibility === "public" ? ICONS.globe : ICONS.lock} size={14} color={t.ink} width={1.5} />
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 14 }]}>{tr(list.visibility === "public" ? "list.publicShare" : "list.privateShare")}</Text>
          </Pressable>
        )}
      </View>
      {picked ? (
        <ToolBar edge="top" tools={[
          { label: tr(`list.mark.${chosenWord}.bulk`), icon: ICONS.tick, onPress: () => { setPicked(null); void mark(chosen.map((e) => e.item.id), true); } },
          { label: tr("list.unmark"), icon: ICONS.ring, onPress: () => { setPicked(null); void mark(chosen.map((e) => e.item.id), false); } },
          { label: tr("list.toTop"), icon: ICONS.toTop, onPress: () => void toTop() },
          { label: tr("list.takeOut"), icon: ICONS.close, onPress: () => void takeOut() },
        ]} />
      ) : list && (
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>{list.name}</Text>
          {list.purpose ? <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{list.purpose}</Text> : null}
          {marked.length > 0 && <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{tr(`list.mark.${word}.progress`, { ticked: marked.length, count: entries.length })}</Text>}
        </View>
      )}
      <FlatList
        data={rows}
        extraData={picked}
        keyExtractor={(r) => (r === "head" ? "head" : r.e.item.id)}
        style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: t.line }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        ListEmptyComponent={data.isLoading ? undefined : <Empty title={tr("list.empty.title")} body={tr("list.empty.body")} />}
        renderItem={({ item: r }) => r === "head" ? (
          // The marked rows fold away under their own header; the device remembers it.
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !folded }} onPress={fold}
            style={({ pressed }) => [styles.group, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.rail }]}>
            <View style={{ transform: [{ rotate: folded ? "0deg" : "90deg" }] }}><Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} /></View>
            <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 13 }]}>{tr(`list.mark.${word}.label`)}</Text>
            <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{marked.length}</Text>
          </Pressable>
        ) : (
          <ItemRow
            item={r.e.item}
            n={r.n}
            below={r.e.note ? (r.e.noteBy === "mcp" ? tr("list.noteByAi", { note: r.e.note }) : r.e.note) : null}
            hideWhen
            marked={r.e.ticked}
            mark={{
              ticked: r.e.ticked,
              label: tr(`list.mark.${markWord(r.e.item.kind)}.label`),
              a11y: tr(`list.mark.${markWord(r.e.item.kind)}.a11y`, { title: r.e.item.title }),
              onPress: () => void mark([r.e.item.id], !r.e.ticked),
            }}
            selecting={Boolean(picked)}
            selected={Boolean(picked?.has(r.e.item.id))}
            onSelect={() => select(r.e.item.id)}
          />
        )}
      />
      {!picked && (
        <Pressable onPress={() => router.push({ pathname: "/pick", params: { mode: "add", id } })} accessibilityRole="button" accessibilityLabel={tr("list.addA11y")} style={[styles.add, { backgroundColor: t.brand, bottom: insets.bottom + 24 }]}>
          <Icon d={ICONS.plus} size={16} color={t.highlight} width={1.8} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>{tr("common.add")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 8 },
  count: { fontSize: 17, paddingHorizontal: 8 },
  textButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  shareButton: { minHeight: 36, marginRight: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  head: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  group: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  add: { position: "absolute", right: 16, minHeight: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8 },
});
