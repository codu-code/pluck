import { extractUrls, TEXT_KINDS, type TextKind } from "@pluck/shared-schemas";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { KindGlyph } from "@/components/Glyph";
import { useColumns } from "@/components/split/context";
import { toast } from "@/components/Toast";
import { pluck } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// The web's Pluck box as a sheet: one link, a block of links, or a sentence that becomes a Note, Todo or Thing.
// A link on the clipboard goes in with iOS's own Paste button, which asks no "Allow Paste?" question.
export default function Add() {
  return useColumns().wide ? <AddWide /> : <AddSheet />;
}

function AddSheet() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<TextKind>("note");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); // a link is on the clipboard (asking does not read it)
  useEffect(() => void Clipboard.hasUrlAsync().then(setCopied).catch(() => {}), []);

  const text = value.trim();
  const isText = Boolean(text) && extractUrls(text).length === 0;

  const submit = async () => {
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { queued } = await pluck(isText ? { text, kind } : { text }); // offline, it waits in the queue
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      toast(tr(queued ? "add.queued" : "add.plucked"));
    } catch {
      setError(tr("add.failed"));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 16 }]}>{tr("common.cancel")}</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{tr("add.title")}</Text>
        <View style={styles.button} />
      </View>
      <View style={styles.body}>
        <TextInput
          value={value}
          onChangeText={(v) => { setValue(v); setError(null); }}
          placeholder={tr("add.placeholder")}
          placeholderTextColor={t.ink2}
          accessibilityLabel={tr("add.placeholder")}
          multiline
          autoFocus
          autoCapitalize="none"
          autoCorrect={isText}
          keyboardType={isText ? "default" : "url"}
          selectionColor={t.accent}
          style={[font.regular, styles.field, { color: t.ink, borderColor: t.lineStrong, backgroundColor: t.surface }]}
        />
        {copied && !text && (
          <Clipboard.ClipboardPasteButton
            acceptedContentTypes={["url", "plain-text"]}
            onPress={(data) => { if (data.type === "text") setValue(data.text); }}
            backgroundColor={t.brand}
            foregroundColor={t.onBrand}
            cornerStyle="capsule"
            displayMode="iconAndLabel"
            style={styles.paste}
          />
        )}
        {isText && (
          // Text with no link: which Kind it becomes, as the web box asks.
          <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel={tr("add.as")}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{tr("add.as")}</Text>
            {TEXT_KINDS.map((k) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)}
                style={[styles.chip, kind === k ? { backgroundColor: t.brand, borderColor: t.brand } : { borderColor: t.lineStrong }]}>
                <Text style={[font.regular, { fontSize: 14, color: kind === k ? t.onBrand : t.ink }]}>{tr(`kinds.${k}`)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {error && <Text accessibilityRole="alert" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !text || busy, busy }} disabled={!text || busy} onPress={() => void submit()}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: !text || busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("add.submit")}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// iPad (iPad-Add): the form sheet with Link, Note, Todo and Thing on top, a title and the words for a Note, Todo
// or Thing, and the keys that pluck and cancel. Tags, a List and a Status are set after, from the Item: a pluck made
// with no connection waits in a queue that only knows how to make the Item.
type Mode = "link" | TextKind;
const MODES: Mode[] = ["link", ...TEXT_KINDS];

function AddWide() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const [mode, setMode] = useState<Mode>("link");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = value.trim();
  const ready = Boolean(text || (mode !== "link" && title.trim()));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = mode === "link" ? { text } : { text: text || title.trim(), kind: mode, ...(title.trim() && text ? { title: title.trim() } : {}) };
      const { queued } = await pluck(body);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      toast(tr(queued ? "add.queued" : "add.plucked"));
    } catch {
      setError(tr("add.failed"));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[wide.head, { borderBottomColor: t.line }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.actionInk, fontSize: 16 }]}>{tr("common.cancel")}</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>
          {mode === "link" ? tr("add.title") : tr("ipad.add.new", { kind: mode })}
        </Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={() => void submit()}
          style={({ pressed }) => [wide.pluck, { backgroundColor: t.brand, opacity: !ready || busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>{tr("ipad.add.pluck")}</Text>}
        </Pressable>
      </View>
      <View style={wide.body}>
        <View style={[wide.segments, { backgroundColor: t.chip }]} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => setMode(m)}
              style={[wide.segment, mode === m && { backgroundColor: t.surface }]}>
              <KindGlyph kind={m} size={14} color={t.ink} />
              <Text maxFontSizeMultiplier={scale.title} style={[mode === m ? font.semibold : font.regular, { color: t.ink, fontSize: 14 }]}>{m === "link" ? tr("ipad.add.link") : tr(`kinds.${m}`)}</Text>
            </Pressable>
          ))}
        </View>
        {mode !== "link" && (
          <TextInput value={title} onChangeText={setTitle} placeholder={tr("ipad.add.titlePlaceholder")} placeholderTextColor={t.ink2} accessibilityLabel={tr("item.titleA11y")}
            selectionColor={t.accent} style={[font.bold, { color: t.ink, fontSize: 24, letterSpacing: -0.24 }]} />
        )}
        <TextInput
          value={value}
          onChangeText={(v) => { setValue(v); setError(null); }}
          placeholder={mode === "link" ? tr("add.placeholder") : tr("item.textPlaceholder")}
          placeholderTextColor={t.ink2}
          accessibilityLabel={mode === "link" ? tr("add.placeholder") : tr("item.textA11y")}
          multiline
          autoFocus
          autoCapitalize={mode === "link" ? "none" : "sentences"}
          autoCorrect={mode !== "link"}
          keyboardType={mode === "link" ? "url" : "default"}
          selectionColor={t.accent}
          style={[font.regular, wide.words, { color: t.ink }]}
        />
        {error && <Text accessibilityRole="alert" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{error}</Text>}
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>
          {tr.rich("ipad.add.keys", { key: (c) => <View style={[wide.key, { borderColor: t.lineStrong }]}><Text maxFontSizeMultiplier={scale.badge} style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{c}</Text></View> })}
        </Text>
      </View>
    </View>
  );
}

const wide = StyleSheet.create({
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  pluck: { height: 34, paddingHorizontal: 16, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  body: { paddingVertical: 18, paddingHorizontal: 20, gap: 16 },
  segments: { flexDirection: "row", padding: 3, borderRadius: 10 },
  segment: { flex: 1, height: 32, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  words: { fontSize: 17, lineHeight: 27, minHeight: 150, maxHeight: 320, textAlignVertical: "top" },
  key: { minWidth: 22, height: 22, paddingHorizontal: 6, borderWidth: 1, borderBottomWidth: 2, borderRadius: 6, alignItems: "center", justifyContent: "center", transform: [{ translateY: 5 }] },
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8, minHeight: 52 },
  button: { minWidth: 72, minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  field: { minHeight: 96, maxHeight: 220, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 17, textAlignVertical: "top" },
  paste: { alignSelf: "flex-start", height: 40, width: 120 },
  kinds: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: "center" },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
});
