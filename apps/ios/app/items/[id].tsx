import { Unreachable } from "@pluck/client";
import { isTextKind, type Item } from "@pluck/shared-schemas";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { toast } from "@/components/Toast";
import { ToolBar, type Tool } from "@/components/ToolBar";
import { keys, useCover, useItem, useOnline, usePatchItem, type FullItem } from "@/lib/data";
import { useRowText } from "@/lib/format";
import { marks, parseMarkdown, type Block } from "@/lib/markdown";
import { api } from "@/lib/session";
import { font, scale, useTheme, type Palette } from "@/lib/theme";

const BACK = { inbox: "tabs.inbox", later: "tabs.later", archived: "item.backArchive", done: "item.backArchive" } as const;

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const tr = useTranslations("ios");
  const data = useItem(id);
  const online = useOnline();
  useEffect(() => void api(`/api/v1/items/${id}/open`, { method: "POST" }).catch(() => {}), [id]); // opening is a touch
  if (!data.data) {
    // No connection and no copy on the phone: not a failure, it opens when the connection is back (the query waits).
    const away = !online || data.fetchStatus === "paused" || data.error instanceof Unreachable;
    return (
      <View style={{ flex: 1, backgroundColor: t.ground }}>
        <TopBar label={tr("item.back")} />
        <View style={styles.centre} accessibilityLiveRegion="polite">
          {away ? (
            <>
              <Icon d={ICONS.offline} size={28} color={t.ink2} width={1.3} />
              <Text style={[font.semibold, { color: t.ink, fontSize: 17, textAlign: "center" }]}>{tr("item.notKept")}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 }]}>{tr("item.notKeptBody")}</Text>
            </>
          ) : data.isError ? (
            <>
              <Text style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{tr("item.didntLoad")}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 15, textAlign: "center" }]}>{tr("item.didntLoadBody")}</Text>
              <Pressable accessibilityRole="button" onPress={() => void data.refetch()} style={[styles.quietButton, { borderColor: t.lineStrong }]}>
                <Text style={[font.medium, { color: t.ink, fontSize: 15 }]}>{tr("common.tryAgain")}</Text>
              </Pressable>
            </>
          ) : <ActivityIndicator accessibilityLabel={tr("common.loading")} />}
        </View>
      </View>
    );
  }
  return isTextKind(data.data.item.kind) ? <NoteEditor data={data.data} /> : <Reader data={data.data} />;
}

function TopBar({ label, right }: { label: string; right?: React.ReactNode }) {
  const t = useTheme();
  const tr = useTranslations("ios.common");
  const top = useSafeAreaInsets().top;
  return (
    <View style={[styles.top, { paddingTop: top + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("backTo", { label })} onPress={() => router.back()} hitSlop={{ left: 8 }} style={styles.back}>
        <Icon d={ICONS.back} size={18} color={t.ink} width={1.6} />
        <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>{label}</Text>
      </Pressable>
      {right}
    </View>
  );
}

// The reader's toolbar (IOSReader board): six actions on the rail.
function Toolbar({ item }: { item: Item }) {
  const tr = useTranslations("ios");
  const patch = usePatchItem();
  const move = (status: "inbox" | "later" | "archived") => {
    patch.mutate({ id: item.id, patch: { status } });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toast(tr(`moved.${status}`), () => patch.mutate({ id: item.id, patch: { status: item.status } }));
    router.back();
  };
  const tools: Tool[] = [
    // From the Archive the one move is back to the Inbox.
    ...(item.status === "archived" || item.status === "done"
      ? [{ label: tr("actions.inbox"), icon: ICONS.inbox, onPress: () => move("inbox") }]
      : [{ label: tr("actions.later"), icon: ICONS.later, onPress: () => move("later") }, { label: tr("actions.archive"), icon: ICONS.archive, onPress: () => move("archived") }]),
    { label: tr("actions.tags"), icon: ICONS.tag, onPress: () => router.push({ pathname: "/pick", params: { mode: "tags", id: item.id } }) },
    { label: tr("actions.list"), icon: ICONS.lists, a11y: tr("actions.addToList"), onPress: () => router.push({ pathname: "/pick", params: { mode: "lists", id: item.id } }) },
    { label: tr("actions.share"), icon: ICONS.share, onPress: () => void Share.share(item.url ? { url: item.url } : { message: item.title }) },
  ];
  // A link gets a Note between the moves and the sorting; notes, todos and things are their own text.
  if (!isTextKind(item.kind)) tools.splice(tools.findIndex((x) => x.icon === ICONS.tag), 0, { label: tr("actions.note"), icon: ICONS.compose, onPress: () => router.push({ pathname: "/note", params: { id: item.id } }) });
  return <ToolBar tools={tools} />;
}

function Reader({ data }: { data: FullItem }) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const format = useFormatter();
  const row = useRowText();
  const { item, text, highlights } = data;
  const patch = usePatchItem();
  const [progress, setProgress] = useState(item.readingProgress);
  const saved = useRef(item.readingProgress);
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const quotes = useMemo(() => highlights.map((h) => h.quote), [highlights]);
  const cover = useCover(item);
  const [ratio, setRatio] = useState(4 / 3);
  const [retrying, setRetrying] = useState(false);
  const qc = useQueryClient();
  const reading = blocks.length > 0;

  const retry = async () => {
    setRetrying(true);
    const res = await api<{ item: Item }>(`/api/v1/items/${item.id}/reextract`, { method: "POST" }).catch(() => null);
    if (res) qc.setQueryData<FullItem>(keys.item(item.id), (old) => (old ? { ...old, item: res.item } : old));
    setRetrying(false);
  };

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
        label={tr(BACK[item.status])}
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {reading && <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink2, fontSize: 13, paddingHorizontal: 4 }]}>{minutes ? tr("item.minutesLeft", { percent: format.number(progress, { style: "percent" }), minutes }) : format.number(progress, { style: "percent" })}</Text>}
            {item.url && (
              <Pressable accessibilityRole="button" accessibilityLabel={tr("item.openOriginal")} onPress={() => void WebBrowser.openBrowserAsync(item.url!)} style={styles.iconButton}>
                <Icon d={ICONS.original} size={20} color={t.ink} width={1.5} />
              </Pressable>
            )}
          </View>
        }
      />
      <View style={[styles.track, { backgroundColor: t.line }]}>{reading && <View style={{ width: `${Math.round(progress * 100)}%`, height: 2, backgroundColor: t.accent }} />}</View>
      <ScrollView
        contentContainerStyle={styles.article}
        scrollEventThrottle={250}
        onScroll={({ nativeEvent: e }) => {
          const room = e.contentSize.height - e.layoutMeasurement.height;
          if (room > 0) setProgress((p) => Math.max(p, Math.min(1, e.contentOffset.y / room)));
        }}
      >
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{row(item).siteMeta}</Text>
        <Text accessibilityRole="header" style={[font.readerTitle, styles.h1, { color: t.ink }]}>{item.title}</Text>
        {item.author ? <Text style={[font.reader, { color: t.ink2, fontStyle: "italic", fontSize: 16 }]}>{tr("item.by", { author: item.author })}</Text> : null}
        {cover && item.kind === "image" && (
          <Image source={cover} style={[styles.image, { aspectRatio: ratio, backgroundColor: t.rail }]} resizeMode="contain" accessibilityLabel={item.title}
            onLoad={(e) => e.nativeEvent.source.height && setRatio(Math.max(0.5, e.nativeEvent.source.width / e.nativeEvent.source.height))} />
        )}
        {item.note ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr("item.noteA11y", { note: item.note })} onPress={() => router.push({ pathname: "/note", params: { id: item.id } })}>
            <Text style={[font.regular, styles.note, { color: t.ink, backgroundColor: t.rail }]}>{item.note}</Text>
          </Pressable>
        ) : null}
        {item.extraction.state === "pending" && (
          <View style={[styles.state, { backgroundColor: t.rail }]} accessibilityLiveRegion="polite">
            <ActivityIndicator color={t.ink2} />
            <Text style={[font.regular, { flex: 1, color: t.ink2, fontSize: 15 }]}>{tr("item.pending")}</Text>
          </View>
        )}
        {item.extraction.state === "failed" && (
          <View style={[styles.failed, { backgroundColor: t.rail }]}>
            <Text style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{tr("item.failed")}</Text>
            <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21 }]}>
              {tr(item.kind === "image" || item.kind === "pdf" ? "item.failedFile" : "item.failedPage")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              {item.url && (
                <Pressable accessibilityRole="button" onPress={() => void WebBrowser.openBrowserAsync(item.url!)} style={[styles.primary, { backgroundColor: t.brand }]}>
                  <Text style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>{tr("item.openOriginal")}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" disabled={retrying} onPress={() => void retry()} style={[styles.quietButton, { borderColor: t.lineStrong, opacity: retrying ? 0.6 : 1 }]}>
                {retrying ? <ActivityIndicator color={t.ink} /> : <Text style={[font.medium, { color: t.ink, fontSize: 15 }]}>{tr("common.tryAgain")}</Text>}
              </Pressable>
            </View>
          </View>
        )}
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
  const tr = useTranslations("ios");
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
        label={tr(BACK[item.status])}
        right={item.kind !== "note" ? (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => patch.mutate({ id: item.id, patch: { status: done ? "inbox" : "done" } })} style={styles.doneButton}>
            <View style={[styles.ring, done ? { borderColor: t.ink, backgroundColor: t.highlight } : { borderColor: t.ringOff }]}>
              {done && <Icon d={ICONS.tick} size={12} color={t.onHighlight} width={2.4} />}
            </View>
            <Text style={[font.regular, { color: t.ink, fontSize: 15 }]}>{tr("common.done")}</Text>
          </Pressable>
        ) : null}
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <TextInput value={title} onChangeText={setTitle} placeholder={item.title} placeholderTextColor={t.ink2} accessibilityLabel={tr("item.titleA11y")}
          style={[font.semibold, { color: t.ink, fontSize: 24, lineHeight: 30 }]} />
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{tr("item.titleHint")}</Text>
        <TextInput value={text} onChangeText={setText} multiline scrollEnabled={false} accessibilityLabel={tr("item.textA11y")} placeholder={tr("item.textPlaceholder")}
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
  image: { width: "100%", borderRadius: 8 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  state: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10 },
  failed: { gap: 6, padding: 16, borderRadius: 10 },
  primary: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quietButton: { minHeight: 44, minWidth: 96, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  doneButton: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12 },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
