import { isTextKind, rowMeta, rowSite, type Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ICONS } from "@/components/Glyph";
import { keys, useItem, usePatchItem, type FullItem } from "@/lib/data";
import { marks, parseMarkdown, type Block } from "@/lib/markdown";
import { api, authHeader, getSession } from "@/lib/session";
import { font, useTheme, type Palette } from "@/lib/theme";

const BACK: Record<Item["status"], string> = { inbox: "Inbox", later: "Later", archived: "Archive", done: "Archive" };

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const data = useItem(id);
  useEffect(() => void api(`/api/v1/items/${id}/open`, { method: "POST" }).catch(() => {}), [id]); // opening is a touch
  if (!data.data) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.ground }}><ActivityIndicator /></View>;
  return isTextKind(data.data.item.kind) ? <NoteEditor data={data.data} /> : <Reader data={data.data} />;
}

function TopBar({ label, right }: { label: string; right?: React.ReactNode }) {
  const t = useTheme();
  const top = useSafeAreaInsets().top;
  return (
    <View style={[styles.top, { paddingTop: top + 8 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
        <Text style={[font.regular, { color: t.ink, fontSize: 15 }]}>{label}</Text>
      </Pressable>
      {right}
    </View>
  );
}

// The reader's toolbar (IOSReader board): six actions on the rail.
function Toolbar({ item }: { item: Item }) {
  const t = useTheme();
  const bottom = useSafeAreaInsets().bottom;
  const patch = usePatchItem();
  const move = (status: "later" | "archived") => {
    patch.mutate({ id: item.id, patch: { status } });
    router.back();
  };
  const tools: [string, string, () => void][] = [
    ["Later", ICONS.later, () => move("later")],
    ["Archive", ICONS.archive, () => move("archived")],
    ["Tags", ICONS.tag, () => router.push({ pathname: "/pick", params: { mode: "tags", id: item.id } })],
    ["List", ICONS.lists, () => router.push({ pathname: "/pick", params: { mode: "lists", id: item.id } })],
    ["Share", ICONS.share, () => void Share.share(item.url ? { url: item.url } : { message: item.title })],
    ["Original", ICONS.original, () => item.url && void WebBrowser.openBrowserAsync(item.url)],
  ];
  return (
    <View style={[styles.toolbar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: Math.max(bottom, 8) }]}>
      {tools.filter(([label]) => label !== "Original" || item.url).map(([label, d, onPress]) => (
        <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.tool}>
          <Icon d={d} color={t.ink} />
          <Text style={[font.regular, { color: t.ink, fontSize: 11 }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Reader({ data }: { data: FullItem }) {
  const t = useTheme();
  const { item, text, highlights } = data;
  const patch = usePatchItem();
  const [progress, setProgress] = useState(item.readingProgress);
  const saved = useRef(item.readingProgress);
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const quotes = useMemo(() => highlights.map((h) => h.quote), [highlights]);
  const [cover, setCover] = useState<{ uri: string; headers: Record<string, string> } | null>(null);

  useEffect(() => {
    if (item.kind !== "image" || !item.hasCover) return;
    void (async () => {
      const s = await getSession();
      const auth = await authHeader();
      if (s && auth) setCover({ uri: `${s.server}/api/v1/items/${item.id}/cover`, headers: { authorization: auth } });
    })();
  }, [item.id, item.kind, item.hasCover]);

  // Reading position goes back to the server as it moves forward, a few times a page at most.
  useEffect(() => {
    if (progress - saved.current < 0.05 && !(progress >= 0.99 && saved.current < 0.99)) return;
    const id = setTimeout(() => {
      saved.current = progress;
      patch.mutate({ id: item.id, patch: { readingProgress: Math.min(1, progress) } });
    }, 800);
    return () => clearTimeout(id);
  }, [progress]); // only on movement; the item and mutation are stable for this screen

  const minutes = item.wordCount ? Math.max(1, Math.round((item.wordCount * (1 - progress)) / 230)) : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <TopBar
        label={BACK[item.status]}
        right={<Text style={[font.regular, { color: t.ink2, fontSize: 13, paddingHorizontal: 12 }]}>{Math.round(progress * 100)}%{minutes ? ` · ${minutes} min left` : ""}</Text>}
      />
      <View style={[styles.track, { backgroundColor: t.line }]}><View style={{ width: `${Math.round(progress * 100)}%`, height: 2, backgroundColor: t.accent }} /></View>
      <ScrollView
        contentContainerStyle={styles.article}
        scrollEventThrottle={250}
        onScroll={({ nativeEvent: e }) => {
          const room = e.contentSize.height - e.layoutMeasurement.height;
          if (room > 0) setProgress((p) => Math.max(p, Math.min(1, e.contentOffset.y / room)));
        }}
      >
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{rowSite(item)} · {rowMeta(item)}</Text>
        <Text accessibilityRole="header" style={[font.readerTitle, styles.h1, { color: t.ink }]}>{item.title}</Text>
        {item.author ? <Text style={[font.reader, { color: t.ink2, fontStyle: "italic", fontSize: 16 }]}>By {item.author}</Text> : null}
        {cover && <Image source={cover} style={styles.image} resizeMode="contain" accessibilityLabel={item.title} />}
        {item.note ? <Text style={[font.regular, styles.note, { color: t.ink, backgroundColor: t.rail }]}>{item.note}</Text> : null}
        {item.extraction.state === "pending" && <Text style={[font.regular, { color: t.ink2 }]}>Plucking the page. It shows here in a moment.</Text>}
        {item.extraction.state === "failed" && <Text style={[font.regular, { color: t.ink2 }]}>Couldn't read this page. Open the original to see it.</Text>}
        {blocks.map((b, i) => <BlockView key={i} block={b} quotes={quotes} t={t} />)}
      </ScrollView>
      <Toolbar item={item} />
    </View>
  );
}

function BlockView({ block, quotes, t }: { block: Block; quotes: string[]; t: Palette }) {
  const runs = marks(block.text, quotes).map((r, i) =>
    r.mark ? <Text key={i} style={{ backgroundColor: t.highlightWash, color: t.ink }}>{r.text}</Text> : r.text,
  );
  switch (block.type) {
    case "heading":
      return <Text style={[font.readerTitle, { color: t.ink, fontSize: block.level <= 2 ? 23 : 20, lineHeight: block.level <= 2 ? 30 : 27, marginTop: 8 }]}>{runs}</Text>;
    case "item":
      return <Text style={[font.reader, styles.body, { color: t.ink, paddingLeft: 16 }]}>{block.ordered ? "" : "• "}{runs}</Text>;
    case "quote":
      return <Text style={[font.reader, styles.body, { color: t.ink2, fontStyle: "italic", paddingLeft: 16 }]}>{runs}</Text>;
    case "code":
      return <Text style={[styles.code, { color: t.ink, backgroundColor: t.rail }]}>{block.text}</Text>;
    default:
      return <Text style={[font.reader, styles.body, { color: t.ink }]}>{runs}</Text>;
  }
}

// Notes, todos and things: the text is the item, typed and kept as you go.
function NoteEditor({ data }: { data: FullItem }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { item } = data;
  const patch = usePatchItem();
  const [title, setTitle] = useState(item.titleIsDerived ? "" : item.title);
  const [text, setText] = useState(data.text);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) return void (first.current = false);
    const id = setTimeout(() => {
      patch.mutate({ id: item.id, patch: { text, title } });
      qc.setQueryData<FullItem>(keys.item(item.id), (old) => (old ? { ...old, text } : old));
    }, 600);
    return () => clearTimeout(id);
  }, [text, title]); // only when the words change

  const done = item.status === "done";
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <TopBar
        label={BACK[item.status]}
        right={item.kind !== "note" ? (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => patch.mutate({ id: item.id, patch: { status: done ? "inbox" : "done" } })} style={styles.doneButton}>
            <View style={[styles.ring, done ? { borderColor: t.ink, backgroundColor: t.highlight } : { borderColor: "#9AA392" }]}>
              {done && <Icon d={ICONS.tick} size={12} color="#151A13" width={2.4} />}
            </View>
            <Text style={[font.regular, { color: t.ink, fontSize: 15 }]}>Done</Text>
          </Pressable>
        ) : null}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardDismissMode="interactive">
        <TextInput value={title} onChangeText={setTitle} placeholder={item.title} placeholderTextColor={t.ink2} accessibilityLabel="Title"
          style={[font.semibold, { color: t.ink, fontSize: 24, lineHeight: 30 }]} />
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>Leave the title empty and the first line is the title. Saves as you type.</Text>
        <TextInput value={text} onChangeText={setText} multiline scrollEnabled={false} accessibilityLabel="Text" placeholder="Write it down."
          placeholderTextColor={t.ink2} style={[font.regular, { color: t.ink, fontSize: 17, lineHeight: 25, minHeight: 300, textAlignVertical: "top" }]} />
      </ScrollView>
      <Toolbar item={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 8 },
  track: { height: 2, marginHorizontal: 16 },
  article: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  h1: { fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  body: { fontSize: 18, lineHeight: 29 },
  code: { fontFamily: "Menlo", fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 8 },
  note: { fontSize: 15, lineHeight: 22, padding: 12, borderRadius: 10 },
  image: { width: "100%", height: 360, borderRadius: 8 },
  toolbar: { flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  tool: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", gap: 3 },
  doneButton: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12 },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
