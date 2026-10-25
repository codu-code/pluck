import { funHandle, HANDLE, handleMove, type Me } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "@/components/Toast";
import { keys, queryClient, useLists, useMe } from "@/lib/data";
import { api } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// The handle (no board: the web's handle field as a sheet). It is in every public List's link, so a change says
// what moves before Save. Make one up only fills the field; nothing changes until Save.
export default function Handle() {
  const { host = "getpluck.io" } = useLocalSearchParams<{ host?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const lists = useLists();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The warning counts public Lists and the lock comes from the account: both fresh, not from the cache.
  useEffect(() => {
    void me.refetch();
    void lists.refetch();
  }, []);
  const current = me.data?.handle ?? "";
  const next = (draft ?? current).trim().replace(/^@/, "");
  const changed = next !== current;
  const valid = HANDLE.test(next);
  const until = me.data?.handleChangeableAt ? new Date(me.data.handleChangeableAt) : null;
  const locked = Boolean(until && until > new Date());
  const publicLists = (lists.data ?? []).filter((l) => l.visibility === "public").length;

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ me: Me }>("/api/v1/me", { method: "PATCH", json: { handle: next } });
      queryClient.setQueryData(keys.me, res.me);
      toast(`You're @${res.me.handle}.`);
      router.back();
    } catch (e) {
      Alert.alert("That did not go through", e instanceof Refused ? e.message : "Check the connection, then try again.");
    } finally {
      setBusy(false);
    }
  };

  const hint = locked
    ? `It can change again on ${until!.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`
    : changed && !valid ? "3 to 24 lowercase letters, numbers or hyphens." : "It goes in the link to every List you make public.";

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.button}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 16 }]}>Cancel</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>Handle</Text>
        <View style={styles.button} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.field, { backgroundColor: t.surface }]}>
          <Text style={[font.regular, styles.prefix, { color: t.ink2 }]}>{host}/@</Text>
          <TextInput
            value={draft ?? current}
            onChangeText={(v) => setDraft(v.toLowerCase())}
            editable={!locked}
            autoFocus={!locked}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="ascii-capable"
            returnKeyType="done"
            onSubmitEditing={() => changed && valid && void save()}
            accessibilityLabel="Handle"
            selectionColor={t.accent}
            style={[font.regular, styles.input, { color: locked ? t.ink2 : t.ink }]}
          />
        </View>
        <View style={styles.under}>
          <Text style={[font.regular, styles.hint, { color: t.ink2 }]}>{hint}</Text>
          {!locked && (
            <Pressable accessibilityRole="button" onPress={() => setDraft(funHandle())} hitSlop={8}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 14 }]}>Make one up</Text>
            </Pressable>
          )}
        </View>

        {changed && valid && (
          <>
            <Text accessibilityLiveRegion="polite" style={[font.regular, styles.warning, { color: t.ink }]}>{handleMove(publicLists, host, next)}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void save()}
              style={({ pressed }) => [styles.save, { backgroundColor: t.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>Save @{next}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDraft(null)} style={styles.keep}>
              <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.ink, fontSize: 15 }]}>Keep @{current}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 },
  button: { minHeight: 44, minWidth: 72, paddingHorizontal: 8, justifyContent: "center" },
  page: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  field: { flexDirection: "row", alignItems: "center", minHeight: 52, borderRadius: 14, paddingHorizontal: 16 },
  prefix: { fontSize: 17 },
  input: { flex: 1, minWidth: 0, fontSize: 17, paddingVertical: 14 },
  under: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 4 },
  hint: { flex: 1, fontSize: 13, lineHeight: 18 },
  warning: { paddingHorizontal: 4, paddingTop: 12, fontSize: 15, lineHeight: 21 },
  save: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, marginTop: 4 },
  keep: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
