import { extractUrls, TEXT_KINDS, type TextKind } from "@pluck/shared-schemas";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { toast } from "@/components/Toast";
import { pluck } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// The web's Pluck box as a sheet: one link, a block of links, or a sentence that becomes a Note, Todo or Thing.
// A link on the clipboard goes in with iOS's own Paste button, which asks no "Allow Paste?" question.
export default function Add() {
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
