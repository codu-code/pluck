import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useItem, usePatchItem } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// The note on a link (no board: the web's note field as a sheet). Cancel leaves it; Done keeps it, empty clears it.
export default function Note() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const item = useItem(id);
  const patch = usePatchItem();
  const [draft, setDraft] = useState<string | null>(null);
  const current = item.data?.item.note ?? "";
  const text = draft ?? current;

  const done = () => {
    if (text.trim() !== current.trim()) patch.mutate({ id, patch: { note: text.trim() || null } });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 16 }]}>Cancel</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>Note</Text>
        <Pressable accessibilityRole="button" onPress={done} style={[styles.button, { alignItems: "flex-end" }]}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>Done</Text>
        </Pressable>
      </View>
      <Text numberOfLines={2} style={[font.regular, styles.about, { color: t.ink2 }]}>{item.data?.item.title ?? " "}</Text>
      <TextInput
        value={text}
        onChangeText={setDraft}
        multiline
        autoFocus
        placeholder="Why you kept it, or what to do with it."
        placeholderTextColor={t.ink2}
        accessibilityLabel="Note"
        selectionColor={t.accent}
        style={[font.regular, styles.field, { color: t.ink }]}
      />
      <Text style={[font.regular, styles.hint, { color: t.ink2 }]}>Only you see it. Search finds it.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 },
  button: { minHeight: 44, minWidth: 72, paddingHorizontal: 8, justifyContent: "center" },
  about: { paddingHorizontal: 20, paddingTop: 4, fontSize: 14, lineHeight: 19 },
  field: { flex: 1, paddingHorizontal: 20, paddingTop: 16, fontSize: 17, lineHeight: 25, textAlignVertical: "top" },
  hint: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 13 },
});
