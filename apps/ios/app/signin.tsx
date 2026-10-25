import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Wordmark } from "@/components/Wordmark";
import { defaultServer, signIn, signInWithKey } from "@/lib/session";
import { font, scale, useTheme, type Palette } from "@/lib/theme";

// Sign in (no board of its own: the web's sign-in page, First run and Brand). The email link does the rest;
// "Use your own server" takes a server address and, for self-hosters, an API key.
// pluck://signin?server=https://… opens with that server filled in, for a self-hosted setup page to link to.
export default function SignIn() {
  const t = useTheme();
  const tr = useTranslations("ios.signin");
  const insets = useSafeAreaInsets();
  const { server: linked, stale } = useLocalSearchParams<{ server?: string; stale?: string }>();
  const [advanced, setAdvanced] = useState(Boolean(linked));
  const [server, setServer] = useState(linked ?? defaultServer);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(stale ? tr("stale") : null);

  const go = async (withKey: boolean) => {
    setBusy(true);
    setError(null);
    const origin = server.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^/\s]+/.test(origin)) {
      setError(tr("notServer"));
      setBusy(false);
      return;
    }
    try {
      const ok = withKey ? await signInWithKey(origin, key) : await signIn(origin);
      if (ok) router.replace("/welcome");
      else if (withKey) setError(tr("badKey"));
    } catch {
      setError(tr("unreachable", { origin }));
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
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
      >
        <Wordmark size={34} />
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.display} style={[font.bold, styles.h1, { color: t.ink }]}>
            {tr.rich("title", { accent: (c) => <Text style={{ color: t.accent }}>{c}</Text> })}
          </Text>
          <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>{tr("lede")}</Text>
        </View>
        {!advanced && <EmailPreview t={t} />}
        {advanced && (
          <View style={{ gap: 8 }}>
            <Text nativeID="server-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("server")}</Text>
            <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL"
              returnKeyType="next" style={field} accessibilityLabel={tr("server")} accessibilityLabelledBy="server-label" />
            <Text nativeID="key-label" style={[font.medium, { color: t.ink, fontSize: 14, marginTop: 8 }]}>{tr("key")}</Text>
            <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="pk_live_…" placeholderTextColor={t.ink2}
              returnKeyType="go" onSubmitEditing={() => void go(useKey)} style={field} accessibilityLabel={tr("keyA11y")} accessibilityLabelledBy="key-label" />
            <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>{tr("noKey")}</Text>
          </View>
        )}
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{error}</Text>}
        <View style={{ marginTop: "auto", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void go(useKey)}
            style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
            {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr(useKey ? "useKey" : "withEmail")}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setAdvanced((a) => !a); setError(null); if (advanced) setServer(defaultServer); }} style={styles.quiet}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? tr("useHost", { host: new URL(defaultServer).host }) : tr("ownServer")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// What lands in their inbox, drawn, so the next step is no surprise (the web's sign-in page has the same).
function EmailPreview({ t }: { t: Palette }) {
  const tr = useTranslations("ios.signin.preview");
  return (
    <View accessible accessibilityLabel={tr("a11y")}
      style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.panelHead, { borderBottomColor: t.line }]}>
        <Text style={[font.semibold, { color: t.ink, fontSize: 13 }]}>Pluck</Text>
        <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink2, fontSize: 13 }]}>{tr("subject")}</Text>
        <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{tr("now")}</Text>
      </View>
      <View style={styles.panelBody}>
        <Text style={[font.bold, styles.panelTitle, { color: t.ink }]}>{tr("title")}</Text>
        <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 22 }]}>{tr("body")}</Text>
        <View style={[styles.panelButton, { backgroundColor: t.brand }]}>
          <Text style={[font.semibold, { color: t.onBrand, fontSize: 14 }]}>{tr("button")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  panel: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, shadowColor: "#151A13", shadowOpacity: 0.1, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  panelBody: { gap: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20 },
  panelTitle: { fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  panelButton: { alignSelf: "flex-start", minHeight: 40, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
