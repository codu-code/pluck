import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { defaultServer, signIn, signInWithKey } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

// Sign in (no board of its own: built from First run and Brand). The email link does the rest;
// "Use your own server" takes a server address and, for self-hosters, an API key.
// pluck://signin?server=https://… opens with that server filled in, for a self-hosted setup page to link to.
export default function SignIn() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const linked = useLocalSearchParams<{ server?: string }>().server;
  const [advanced, setAdvanced] = useState(Boolean(linked));
  const [server, setServer] = useState(linked ?? defaultServer);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (withKey: boolean) => {
    setBusy(true);
    setError(null);
    const origin = server.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^/\s]+/.test(origin)) {
      setError("That isn't a server address. It starts with https://.");
      setBusy(false);
      return;
    }
    try {
      const ok = withKey ? await signInWithKey(origin, key) : await signIn(origin);
      if (ok) router.replace("/welcome");
      else if (withKey) setError("That key did not work on this server.");
    } catch {
      setError(`Couldn't reach ${origin}.`);
    }
    setBusy(false);
  };

  const field = [styles.field, font.regular, { borderColor: t.lineStrong, backgroundColor: t.surface, color: t.ink }];
  const useKey = advanced && key.trim().length > 0;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
      >
        <Image source={require("../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors accessibilityLabel="Pluck" />
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.display} style={[font.bold, styles.h1, { color: t.ink }]}>Sign in to Pluck</Text>
          <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>We email you a link. No password, no profile form.</Text>
        </View>
        {advanced && (
          <View style={{ gap: 8 }}>
            <Text nativeID="server-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>Server</Text>
            <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL"
              returnKeyType="next" style={field} accessibilityLabel="Server" accessibilityLabelledBy="server-label" />
            <Text nativeID="key-label" style={[font.medium, { color: t.ink, fontSize: 14, marginTop: 8 }]}>API key, if you use one</Text>
            <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="pk_live_…" placeholderTextColor={t.ink2}
              returnKeyType="go" onSubmitEditing={() => void go(useKey)} style={field} accessibilityLabel="API key" accessibilityLabelledBy="key-label" />
            <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>No key? Leave it empty and we email you a link from that server.</Text>
          </View>
        )}
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[font.regular, { color: t.danger, fontSize: 15 }]}>{error}</Text>}
        <View style={{ marginTop: "auto", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void go(useKey)}
            style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
            {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{useKey ? "Use this key" : "Sign in"}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setAdvanced((a) => !a); setError(null); if (advanced) setServer(defaultServer); }} style={styles.quiet}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? `Use ${new URL(defaultServer).host}` : "Use your own server"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  icon: { width: 56, height: 56, borderRadius: 13 },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
