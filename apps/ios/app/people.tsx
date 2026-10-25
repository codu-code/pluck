import type { ListShare } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon, ICONS } from "@/components/Glyph";
import { toast } from "@/components/Toast";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// Who a List is shared with, See only (the web's People panel): add someone by email, tap to stop sharing.
export default function People() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const people = useQuery({ queryKey: ["people", id], queryFn: async () => (await api<{ people: ListShare[] }>(`/api/v1/lists/${id}/people`)).people });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const failed = (e: unknown) => Alert.alert("That did not go through", e instanceof Refused ? e.message : "Check the connection, then try again.");

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { person } = await api<{ person: ListShare }>(`/api/v1/lists/${id}/people`, { json: { email } });
      setEmail("");
      toast(`Shared with ${person.email}. They get an email with a link.`);
      void people.refetch();
    } catch (e) {
      failed(e);
    }
    setBusy(false);
  };
  const remove = (p: ListShare) =>
    Alert.alert(`Stop sharing with ${p.email}?`, "They can no longer see it. Share again any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Stop sharing", style: "destructive", onPress: () => void api(`/api/v1/lists/${id}/people/${p.id}`, { method: "DELETE" }).then(() => people.refetch()).catch(failed) },
    ]);

  return (
    <FlatList
      style={{ backgroundColor: t.ground }}
      data={people.data ?? []}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ paddingTop: 16, gap: 10 }}>
          <View style={styles.head}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 18 }]}>People</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.addRow}>
            <TextInput value={email} onChangeText={setEmail} placeholder="Their email" placeholderTextColor={t.ink2} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => void add()}
              accessibilityLabel="Share with someone: their email" selectionColor={t.accent}
              style={[font.regular, styles.field, { backgroundColor: t.surface, borderColor: t.lineStrong, color: t.ink }]} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void add()} style={[styles.share, { backgroundColor: t.brand, opacity: busy ? 0.6 : 1 }]}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>Share</Text>
            </Pressable>
          </View>
          <Text style={[font.regular, styles.hint, { color: t.ink2 }]}>They get an email with a link. They see the List, never your tags or ticks; only you change it.</Text>
        </View>
      }
      renderItem={({ item: p }) => (
        <Pressable accessibilityRole="button" accessibilityHint="Stop sharing" onPress={() => remove(p)}
          style={({ pressed }) => [styles.row, { borderBottomColor: t.line, backgroundColor: pressed ? t.selected : t.ground }]}>
          <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{p.email}</Text>
          <Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 8 },
  done: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  field: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  share: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  hint: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
