import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";
import { Wordmark } from "@/components/Wordmark";
import { defaultServer, sendSignInLink, showServerChoice, signIn, signInWithCode, signInWithKey } from "@/lib/session";
import { font, scale, useTheme, type Palette } from "@/lib/theme";

type State = "idle" | "sending" | "sent" | "resending" | "resent" | "invalid" | "error" | "limited";
type CodeState = "idle" | "checking" | "bad" | "spent" | "limited" | "error";
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const RESEND_AFTER = 60_000; // the server allows one link a minute per address too

// Sign in (no board of its own: the web's sign-in page, First run and Brand). One field, the email. The email we send
// has a link and a 6-digit code: tap the link on this iPhone, or type the code here if the email is open somewhere
// else. Beside the field is a picture that follows what is happening, never a control: a slot waiting for the email,
// then the email landing and being tapped. "Use your own server" (self-hosting builds only) takes a server address
// and, optionally, an API key.
// pluck://signin?server=https://… opens with that server filled in, for a self-hosted setup page to link to.
export default function SignIn() {
  const t = useTheme();
  const tr = useTranslations("ios.signin");
  const insets = useSafeAreaInsets();
  const { server: linked, stale } = useLocalSearchParams<{ server?: string; stale?: string }>();
  const [advanced, setAdvanced] = useState(Boolean(linked));
  const [server, setServer] = useState(linked ?? defaultServer);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(stale ? tr("stale") : null);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sent = state === "sent" || state === "resending" || state === "resent";
  const busy = state === "sending" || state === "resending";
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const target = () => (advanced ? server.trim().replace(/\/+$/, "") : defaultServer);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const send = async () => {
    setError(null);
    if (!looksLikeEmail(email)) return setState("invalid");
    if (!/^https?:\/\/[^/\s]+/.test(target())) return setError(tr("notServer"));
    setState(sent ? "resending" : "sending");
    const result = await sendSignInLink(email, target());
    if (result === "password") {
      // App Review's account has a password and no mailbox: the web sheet asks for it.
      setState("idle");
      if (await signIn(target())) router.replace("/welcome");
      return;
    }
    if (result === "sent") {
      setResendAt(Date.now() + RESEND_AFTER);
      setNow(Date.now());
      setCode("");
      setCodeState("idle");
    }
    if (sent && result !== "sent") {
      // A resend that did not go: the email already sent still stands.
      setState("sent");
      return setError(tr(result === "limited" ? "limited" : "error"));
    }
    setState(result === "sent" ? (sent ? "resent" : "sent") : result);
  };
  const tryCode = async (value: string) => {
    setCodeState("checking");
    const result = await signInWithCode(email, value, target());
    if (result === "ok") return router.replace("/welcome");
    setCodeState(result);
  };
  const withKey = async () => {
    setError(null);
    setState("sending");
    try {
      if (await signInWithKey(target(), key)) return router.replace("/welcome");
      setError(tr("badKey"));
    } catch {
      setError(tr("unreachable", { origin: target() }));
    }
    setState("idle");
  };

  const message = error ?? (state === "invalid" ? tr("invalid") : state === "error" ? tr("error") : state === "limited" ? tr("limited") : null);
  const codeMessage = codeState === "bad" ? tr("code.bad") : codeState === "spent" ? tr("code.spent") : codeState === "limited" ? tr("code.limited") : codeState === "error" ? tr("error") : null;
  const field = [styles.field, font.regular, { borderColor: state === "invalid" ? t.danger : t.lineStrong, backgroundColor: t.surface, color: t.ink }];
  const useKey = advanced && key.trim().length > 0;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
      >
        <Wordmark size={34} />
        <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.display} style={[font.display, styles.h1, { color: t.ink }]}>
            {tr.rich(sent ? "sent.title" : "title", { accent: (c) => <Text style={{ color: t.accent }}>{c}</Text> })}
          </Text>
          <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>
            {sent ? tr.rich("sent.lede", { email: email.trim(), b: (c) => <Text style={[font.semibold, { color: t.ink }]}>{c}</Text> }) : tr("lede")}
          </Text>
        </View>

        {/* The picture and the one thing to type sit together. */}
        <View style={{ gap: 14 }}>
          {!advanced && <Story t={t} sent={sent} sending={busy && !sent} email={email.trim()} />}
          {sent ? (
            <View style={{ gap: 8 }}>
              <Text nativeID="code-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("code.label")}</Text>
              <TextInput value={code} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
                editable={codeState !== "checking"} placeholder="000000" placeholderTextColor={t.lineStrong}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 6);
                  setCode(digits);
                  if (codeState !== "checking") setCodeState("idle");
                  if (digits.length === 6) void tryCode(digits);
                }}
                style={[styles.code, font.semibold, { borderColor: codeMessage ? t.danger : t.lineStrong, backgroundColor: t.surface, color: t.ink }]}
                accessibilityLabel={tr("code.a11y")} accessibilityLabelledBy="code-label" />
              {codeState === "checking" && <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{tr("code.checking")}</Text>}
              {codeMessage && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{codeMessage}</Text>}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Text nativeID="email-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("email")}</Text>
              <TextInput value={email} onChangeText={(v) => { setEmail(v); if (state === "invalid") setState("idle"); }}
                autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
                placeholder={tr("emailPlaceholder")} placeholderTextColor={t.ink2} returnKeyType="send" editable={!busy}
                onSubmitEditing={() => void (useKey ? withKey() : send())}
                style={field} accessibilityLabel={tr("email")} accessibilityLabelledBy="email-label" />
            </View>
          )}
        </View>
        {advanced && !sent && (
          <View style={{ gap: 8 }}>
            <Text nativeID="server-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("server")}</Text>
            <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL"
              returnKeyType="next" style={field} accessibilityLabel={tr("server")} accessibilityLabelledBy="server-label" />
            <Text nativeID="key-label" style={[font.medium, { color: t.ink, fontSize: 14, marginTop: 8 }]}>{tr("key")}</Text>
            <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="pk_live_…" placeholderTextColor={t.ink2}
              returnKeyType="go" onSubmitEditing={() => void withKey()} style={field} accessibilityLabel={tr("keyA11y")} accessibilityLabelledBy="key-label" />
            <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>{tr("noKey")}</Text>
          </View>
        )}
        {message && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{message}</Text>}
        {state === "resent" && <Text accessibilityLiveRegion="polite" style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21 }]}>{tr("sent.another")}</Text>}

        <View style={{ marginTop: "auto", gap: 8 }}>
          {sent ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => void Linking.openURL("message://").catch(() => {})}
                style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 }]}>
                <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("sent.openMail")}</Text>
              </Pressable>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy || wait > 0 }} disabled={busy || wait > 0} onPress={() => void send()} style={styles.quiet}>
                  <Text style={[font.medium, { color: wait > 0 ? t.ink2 : t.actionInk, fontSize: 15, fontVariant: ["tabular-nums"] }]}>
                    {busy ? tr("sending") : wait > 0 ? tr("sent.wait", { seconds: wait }) : tr("sent.again")}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setState("idle"); setError(null); setCodeState("idle"); setCode(""); }} style={styles.quiet}>
                  <Text style={[font.medium, { color: t.actionInk, fontSize: 15 }]}>{tr("sent.different")}</Text>
                </Pressable>
              </View>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18, textAlign: "center" }]}>{tr("sent.spam")}</Text>
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void (useKey ? withKey() : send())}
                style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
                {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr(useKey ? "useKey" : "send")}</Text>}
              </Pressable>
              {(showServerChoice || linked) && (
                <Pressable accessibilityRole="button" onPress={() => { setAdvanced((a) => !a); setError(null); if (advanced) setServer(defaultServer); }} style={styles.quiet}>
                  <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? tr("useHost", { host: new URL(defaultServer).host }) : tr("ownServer")}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// The feature piece. Before sending: an empty slot with an envelope floating in it, waiting. Sending: the
// envelope lifts off. Sent: the email lands like a notification, addressed to them, and a fingertip taps its link
// now and again, which is what to do next, shown. One description for VoiceOver; Reduce Motion keeps it still.
function Story({ t, sent, sending, email }: { t: Palette; sent: boolean; sending: boolean; email: string }) {
  const tr = useTranslations("ios.signin.story");
  return (
    <View accessible accessibilityLabel={sent ? tr("sentA11y", { email }) : tr("waitingA11y")}>
      {sent ? (
        <Animated.View key="sent" entering={FadeIn.duration(200)} style={{ gap: 10 }}>
          <Text style={[font.medium, { color: t.ink2, fontSize: 13 }]}>{tr("landed")}</Text>
          <EmailLanding t={t} email={email} />
        </Animated.View>
      ) : (
        <Animated.View key="waiting" exiting={FadeOut.duration(180)} style={{ gap: 10 }}>
          <Text style={[font.medium, { color: t.ink2, fontSize: 13 }]}>{tr("waiting")}</Text>
          <Slot t={t} sending={sending} />
        </Animated.View>
      )}
    </View>
  );
}

function Slot({ t, sending }: { t: Palette; sending: boolean }) {
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!reduced) bob.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, bob]);
  useEffect(() => {
    lift.value = withTiming(sending && !reduced ? 1 : 0, { duration: sending ? 520 : 0, easing: Easing.in(Easing.cubic) });
  }, [sending, reduced, lift]);
  const envelope = useAnimatedStyle(() => ({
    opacity: 1 - lift.value,
    transform: [{ translateY: -6 * bob.value - 70 * lift.value }, { rotate: `${-4 + 4 * bob.value - 8 * lift.value}deg` }, { scale: 1 - 0.15 * lift.value }],
  }));
  return (
    <View style={[styles.slot, { borderColor: t.lineStrong }]}>
      <Animated.View style={envelope}>
        {/* The envelope, and the wordmark's three sparks off its top-right corner (60, 6), clear of the edges. */}
        <Svg width={84} height={62} viewBox="0 -10 80 58">
          <Path d="M6 6h52a2 2 0 0 1 2 2v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill={t.surface} stroke={t.brand} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M5 9l27 19L59 9" fill="none" stroke={t.brand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M63.5 0.5L65 -5.5M67.5 3.5L72.5 -0.5M68.5 8.5L74.5 7.5" fill="none" stroke={t.accent} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// The email, landing and being tapped, on a five-second loop: it drops in like a notification, a fingertip drifts
// in and presses its link, a ripple spreads, it goes, it comes again. The link is a pale tint, never a solid
// button: the only solid button on this screen is the real one.
const LOOP = { arrive: 450, tap: 1300, leave: 3900, gone: 4300, total: 5000 };

function EmailLanding({ t, email }: { t: Palette; email: string }) {
  const tr = useTranslations("ios.signin.preview");
  const reduced = useReducedMotion();
  const clock = useSharedValue(reduced ? LOOP.arrive : 0); // ms into the loop
  useEffect(() => {
    if (!reduced) clock.value = withRepeat(withTiming(LOOP.total, { duration: LOOP.total, easing: Easing.linear }), -1);
  }, [reduced, clock]);
  const card = useAnimatedStyle(() => {
    const ms = clock.value;
    const eased = 1 - Math.pow(1 - Math.min(1, ms / LOOP.arrive), 3);
    const out = ms < LOOP.leave ? 0 : Math.min(1, (ms - LOOP.leave) / (LOOP.gone - LOOP.leave));
    return { opacity: eased * (1 - out), transform: [{ translateY: (1 - eased) * -24 - out * 12 }, { scale: 0.97 + eased * 0.03 }] };
  });
  // The fingertip press: 0 to 1 and back over 260 ms.
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
    <Animated.View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }, card]}>
      <View style={[styles.panelHead, { borderBottomColor: t.line }]}>
        <Text style={[font.semibold, { color: t.ink, fontSize: 13 }]}>Pluck</Text>
        <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink2, fontSize: 13 }]}>{tr("to", { email })}</Text>
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
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 24 },
  slot: { height: 168, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  panel: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, shadowColor: "#151A13", shadowOpacity: 0.1, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  panelBody: { gap: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20 },
  panelTitle: { fontSize: 24, lineHeight: 26, letterSpacing: -0.48 },
  panelLink: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", overflow: "hidden" },
  ripple: { position: "absolute", width: 44, height: 44, borderRadius: 22, top: -4, right: 14 },
  finger: { position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 2, top: 10, right: 20 },
  h1: { fontSize: 46, lineHeight: 46, letterSpacing: -1.6, paddingTop: 4 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  code: { minHeight: 60, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 28, letterSpacing: 10, textAlign: "center", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", justifyContent: "center", gap: 24 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
