import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Wordmark } from "@/components/Wordmark";
import { defaultServer, showServerChoice, signIn, signInWithKey } from "@/lib/session";
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
          {(showServerChoice || linked) && (
            <Pressable accessibilityRole="button" onPress={() => { setAdvanced((a) => !a); setError(null); if (advanced) setServer(defaultServer); }} style={styles.quiet}>
              <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? tr("useHost", { host: new URL(defaultServer).host }) : tr("ownServer")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// What lands in their inbox, played rather than drawn, so it reads as "this is what happens next" and not as a
// button on this screen. It is captioned as the email, its link is a quiet tint (the only solid button here is the
// real one), and it loops: the email drops in like a notification, a fingertip taps its link, it goes, it comes
// again. One description for VoiceOver; with Reduce Motion it simply sits there.
const LOOP = { arrive: 450, tap: 1300, leave: 3900, gone: 4300, total: 5000 };

function EmailPreview({ t }: { t: Palette }) {
  const tr = useTranslations("ios.signin.preview");
  const reduced = useReducedMotion();
  const clock = useSharedValue(reduced ? LOOP.arrive : 0); // ms into the loop
  useEffect(() => {
    if (reduced) return;
    clock.value = withRepeat(withTiming(LOOP.total, { duration: LOOP.total, easing: Easing.linear }), -1);
  }, [reduced, clock]);
  const card = useAnimatedStyle(() => {
    const ms = clock.value;
    const inP = Math.min(1, ms / LOOP.arrive);
    const eased = 1 - Math.pow(1 - inP, 3);
    const outP = ms < LOOP.leave ? 0 : Math.min(1, (ms - LOOP.leave) / (LOOP.gone - LOOP.leave));
    return { opacity: eased * (1 - outP), transform: [{ translateY: (1 - eased) * -24 - outP * 12 }, { scale: 0.97 + eased * 0.03 }] };
  });
  // The fingertip: drifts in, presses (0 to 1 over 260 ms), lifts and fades.
  const press = (ms: number) => {
    "worklet";
    return ms < LOOP.tap ? 0 : ms < LOOP.tap + 130 ? (ms - LOOP.tap) / 130 : ms < LOOP.tap + 260 ? 1 - (ms - LOOP.tap - 130) / 130 : 0;
  };
  const finger = useAnimatedStyle(() => {
    const ms = clock.value;
    const show = ms < LOOP.tap - 500 || ms > LOOP.tap + 900 ? 0 : ms < LOOP.tap - 200 ? (ms - (LOOP.tap - 500)) / 300 : ms > LOOP.tap + 600 ? 1 - (ms - LOOP.tap - 600) / 300 : 1;
    const drift = ms < LOOP.tap ? Math.max(0, (LOOP.tap - ms) / 500) : 0;
    return { opacity: show * 0.55, transform: [{ translateX: drift * 18 }, { translateY: drift * 14 }, { scale: 1 - press(ms) * 0.18 }] };
  });
  const ripple = useAnimatedStyle(() => {
    const p = clock.value < LOOP.tap + 130 ? 0 : Math.min(1, (clock.value - LOOP.tap - 130) / 700);
    return { opacity: p === 0 || p === 1 ? 0 : 0.5 * (1 - p), transform: [{ scale: 0.5 + p * 1.6 }] };
  });
  const link = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press(clock.value) * 0.04 }] }));
  return (
    <View style={{ gap: 10 }} accessible accessibilityLabel={tr("a11y")}>
      <Text style={[font.medium, { color: t.ink2, fontSize: 13 }]}>{tr("caption")}</Text>
      <Animated.View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }, card]}>
        <View style={[styles.panelHead, { borderBottomColor: t.line }]}>
          <Text style={[font.semibold, { color: t.ink, fontSize: 13 }]}>Pluck</Text>
          <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink2, fontSize: 13 }]}>{tr("subject")}</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{tr("now")}</Text>
        </View>
        <View style={styles.panelBody}>
          <Text style={[font.bold, styles.panelTitle, { color: t.ink }]}>{tr("title")}</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 22 }]}>{tr("body")}</Text>
          <View style={{ alignSelf: "flex-start" }}>
            <Animated.View style={[styles.panelLink, { backgroundColor: t.highlightWash }, link]}>
              <Text style={[font.semibold, { color: t.actionInk, fontSize: 14 }]}>{tr("button")}</Text>
              <Animated.View pointerEvents="none" style={[styles.ripple, { backgroundColor: t.highlight }, ripple]} />
            </Animated.View>
            {!reduced && <Animated.View pointerEvents="none" style={[styles.finger, { backgroundColor: t.ink2, borderColor: t.surface }, finger]} />}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  panel: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, shadowColor: "#151A13", shadowOpacity: 0.1, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  panelBody: { gap: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20 },
  panelTitle: { fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  panelLink: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", overflow: "hidden" },
  ripple: { position: "absolute", width: 44, height: 44, borderRadius: 22, top: -4, right: 14 },
  finger: { position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 2, top: 10, right: 20 },
  h1: { fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
