import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { defaultServer, signIn, signInWithKey } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// Sign in (no board of its own: built from First run and Brand). The email link does the rest;
// "Use your own server" takes a server address and, for self-hosters, an API key.
export default function SignIn() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [advanced, setAdvanced] = useState(false);
  const [server, setServer] = useState(defaultServer);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (withKey: boolean) => {
    setBusy(true);
    setError(null);
    const origin = server.trim().replace(/\/+$/, "");
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
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.page, { backgroundColor: t.ground, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
      <Image source={require("../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={[font.bold, styles.h1, { color: t.ink }]}>Sign in to Pluck</Text>
        <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>We email you a link. No password, no profile form.</Text>
      </View>
      {advanced && (
        <View style={{ gap: 10 }}>
          <Text style={[font.medium, { color: t.ink, fontSize: 14 }]}>Server</Text>
          <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={field} accessibilityLabel="Server" />
          <Text style={[font.medium, { color: t.ink, fontSize: 14, marginTop: 6 }]}>API key, if you use one</Text>
          <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="pk_live_…" placeholderTextColor={t.ink2} style={field} accessibilityLabel="API key" />
        </View>
      )}
      {error && <Text style={[font.regular, { color: t.danger }]}>{error}</Text>}
      <View style={{ marginTop: "auto", gap: 12 }}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void go(advanced && key.trim().length > 0)} style={[styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={t.onBrand} /> : <Text style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{advanced && key.trim() ? "Use this key" : "Sign in"}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setAdvanced((a) => !a)} style={styles.quiet}>
          <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? "Use getpluck.io" : "Use your own server"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, gap: 28 },
  icon: { width: 56, height: 56, borderRadius: 13 },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  primary: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quiet: { alignItems: "center", paddingVertical: 8 },
});
