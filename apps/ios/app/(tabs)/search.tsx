import type { Kind, Status } from "@pluck/shared-schemas";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon, ICONS, KIND_NAMES, KindGlyph } from "@/components/Glyph";
import { Empty, TitledList } from "@/components/Screen";
import { useLists, useSearch, useTags, type SearchFilters } from "@/lib/data";
import { font, useTheme } from "@/lib/theme";

const STATUS: Record<Status, string> = { inbox: "Inbox", later: "Later", archived: "Archived", done: "Done" };
const KINDS = Object.keys(KIND_NAMES) as Kind[];
const DATES = [["Any time", 0], ["This week", 7], ["This month", 31], ["This year", 366]] as const;

// Picks one of a few options from the system action sheet; the last button clears the filter.
function pick(title: string, options: string[], clear: string, done: (i: number | null) => void) {
  ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options, clear, "Cancel"], cancelButtonIndex: options.length + 1 }, (i) => {
    if (i < options.length) done(i);
    else if (i === options.length) done(null);
  });
}

// Search (IOSSearch board): words in titles, notes, tags, list names and the page body, with filters.
export default function Search() {
  const t = useTheme();
  const initial = useLocalSearchParams<{ q?: string }>().q ?? ""; // pluck://search?q=… opens on a search
  const [text, setText] = useState(initial);
  const [q, setQ] = useState("");
  const [f, setF] = useState<SearchFilters & { kindName?: string; tagName?: string; listName?: string; dateName?: string }>({});
  const tags = useTags();
  const lists = useLists();
  const results = useSearch(q, f);

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={[styles.chip, on ? { backgroundColor: t.brand, borderColor: t.brand } : { borderColor: t.lineStrong }]}>
      <Text style={[font.regular, { fontSize: 14, color: on ? t.onBrand : t.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <TitledList
      title="Search"
      bold
      head={
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
          <View style={[styles.field, { backgroundColor: t.surface, borderColor: t.ink }]}>
            <Icon d={ICONS.search} size={16} color={t.ink} width={1.5} />
            <TextInput value={text} onChangeText={setText} placeholder="Search" placeholderTextColor={t.ink2} returnKeyType="search" autoCorrect={false}
              clearButtonMode="while-editing" accessibilityLabel="Search" style={[font.regular, { flex: 1, color: t.ink, fontSize: 15, paddingVertical: 10 }]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {chip(f.kindName ?? "Any kind", Boolean(f.kinds), () =>
              pick("Kind", KINDS.map((k) => KIND_NAMES[k]), "Any kind", (i) => setF((x) => ({ ...x, kinds: i === null ? undefined : [KINDS[i]!], kindName: i === null ? undefined : KIND_NAMES[KINDS[i]!] }))))}
            {chip(f.tagName ?? "Tag", Boolean(f.tagIds), () =>
              pick("Tag", (tags.data ?? []).map((x) => x.name), "Any tag", (i) => setF((x) => ({ ...x, tagIds: i === null ? undefined : [tags.data![i]!.id], tagName: i === null ? undefined : tags.data![i]!.name }))))}
            {chip(f.listName ?? "List", Boolean(f.listId), () =>
              pick("List", (lists.data ?? []).map((x) => x.name), "Any list", (i) => setF((x) => ({ ...x, listId: i === null ? undefined : lists.data![i]!.id, listName: i === null ? undefined : lists.data![i]!.name }))))}
            {chip(f.status ? STATUS[f.status] : "Status", Boolean(f.status), () =>
              pick("Status", Object.values(STATUS), "Any status", (i) => setF((x) => ({ ...x, status: i === null ? undefined : (Object.keys(STATUS)[i] as Status) }))))}
            {chip(f.dateName ?? "Date", Boolean(f.since), () =>
              pick("Plucked", DATES.slice(1).map(([n]) => n), "Any time", (i) => setF((x) => ({
                ...x, since: i === null ? undefined : new Date(Date.now() - DATES[i + 1]![1] * 86_400_000).toISOString(), dateName: i === null ? undefined : DATES[i + 1]![0],
              }))))}
          </ScrollView>
        </View>
      }
      data={q ? (results.data?.results ?? []) : []}
      keyExtractor={(r) => r.item.id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: { item, snippet } }) => (
        <Pressable onPress={() => router.push(`/items/${item.id}`)} accessibilityRole="button"
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
          <View style={{ marginTop: 1 }}><KindGlyph kind={item.kind} size={18} color={t.ink} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{item.title}</Text>
            {snippet && (
              <Text style={[font.regular, { color: t.ink2, fontSize: 14, lineHeight: 20 }]} numberOfLines={2}>
                {snippet.source === "note" ? "Your note: " : ""}{snippet.pre}
                <Text style={{ backgroundColor: t.highlightWash, color: t.ink }}>{snippet.hit}</Text>{snippet.post}
              </Text>
            )}
            <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{STATUS[item.status]}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        !q ? <Empty title="Find it again." body="Titles, notes, tags, lists and the words on the page." />
          : results.isError ? <Empty title="Search didn't answer." body="Check the connection, then try again." />
            : results.data ? <Empty title="Nothing plucked matches that." body="Try fewer words, or another filter." /> : undefined
      }
      ListFooterComponent={q ? <Text style={[font.regular, styles.footer, { color: t.ink2 }]}>Want it by meaning? Ask your AI.</Text> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5 },
  chip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: "center" },
  row: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  footer: { padding: 24, textAlign: "center", fontSize: 14 },
});
