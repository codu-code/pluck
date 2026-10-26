import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isRenameable } from "@pluck/shared-schemas";
import { useTranslations } from "use-intl";
import { useItem, usePatchItem } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// The note on a link (no board: the web's note field as a sheet). Cancel leaves it; Done keeps it, empty clears it.
// A reel, a post or a picture can be named here too: it often came with no title of its own (isRenameable).
export default function Note() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const tr = useTranslations("ios");
  const item = useItem(id);
  const patch = usePatchItem();
  const [draft, setDraft] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const current = item.data?.item.note ?? "";
  const text = draft ?? current;
  const named = item.data?.item.title ?? "";
  const title = titleDraft ?? named;
  const renameable = item.data ? isRenameable(item.data.item) : false;

  const done = () => {
    const typed = title.replace(/\s*\n\s*/g, " ").trim().slice(0, 500); // one line, the API's limit; empty keeps the old title
    const edit = {
      ...(text.trim() !== current.trim() ? { note: text.trim() || null } : {}),
      ...(renameable && titleDraft !== null && typed && typed !== named ? { title: typed } : {}), // only when it was edited
    };
    if (Object.keys(edit).length) patch.mutate({ id, patch: edit });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 16 }]}>{tr("common.cancel")}</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{tr("note.title")}</Text>
        <Pressable accessibilityRole="button" onPress={done} style={[styles.button, { alignItems: "flex-end" }]}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("common.done")}</Text>
        </Pressable>
      </View>
      {renameable ? (
        <TextInput
          value={title}
          onChangeText={setTitleDraft}
          maxLength={500}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="next"
          accessibilityLabel={tr("note.titleLabel")}
          placeholder={tr("note.titleLabel")}
          placeholderTextColor={t.ink2}
          selectionColor={t.accent}
          style={[font.semibold, styles.title, { color: t.ink, borderBottomColor: t.line }]}
        />
      ) : (
        <Text numberOfLines={2} style={[font.regular, styles.about, { color: t.ink2 }]}>{item.data?.item.title ?? " "}</Text>
      )}
      <TextInput
        value={text}
        onChangeText={setDraft}
        multiline
        autoFocus={!renameable}
        placeholder={tr("note.placeholder")}
        placeholderTextColor={t.ink2}
        accessibilityLabel={tr("note.title")}
        selectionColor={t.accent}
        style={[font.regular, styles.field, { color: t.ink }]}
      />
      <Text style={[font.regular, styles.hint, { color: t.ink2 }]}>{tr("note.hint")}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 },
  button: { minHeight: 44, minWidth: 72, paddingHorizontal: 8, justifyContent: "center" },
  about: { paddingHorizontal: 20, paddingTop: 4, fontSize: 14, lineHeight: 19 },
  title: { marginHorizontal: 20, paddingTop: 8, paddingBottom: 12, fontSize: 20, lineHeight: 26, borderBottomWidth: StyleSheet.hairlineWidth },
  field: { flex: 1, paddingHorizontal: 20, paddingTop: 16, fontSize: 17, lineHeight: 25, textAlignVertical: "top" },
  hint: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 13 },
});
