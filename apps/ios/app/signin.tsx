import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";
import { Wordmark } from "@/components/Wordmark";
import { defaultServer, sendSignInCode, showServerChoice, signInWithCode, signInWithKey } from "@/lib/session";
import { font, scale, useTheme, type Palette } from "@/lib/theme";

type Step = "email" | "code" | "password";
type Status = "idle" | "busy" | "invalid" | "bad" | "spent" | "limited" | "error" | "resent";
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const RESEND_AFTER = 60_000; // the server allows one code a minute per address too

// Whether the keyboard is up (or on its way up), from the moment it starts to move.
function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return up;
}

// Sign in (no board of its own: the web's sign-in page, First run and Brand). Two things to type, one at a time: the
// email, then the 6-digit code we send to it. Never a link: a link would come back through a URL scheme another app
// could claim (lib/session.ts). Above each field is a picture that follows what is happening, never a control.
// App Review's address, which has no mailbox, gets a password field instead of a code. "Use your own server"
// (self-hosting builds only) takes a server address and, optionally, an API key.
// pluck://signin?server=https://… opens with that server filled in, for a self-hosted setup page to link to.
export default function SignIn() {
  const t = useTheme();
  const tr = useTranslations("ios.signin");
  const insets = useSafeAreaInsets();
  const { server: linked } = useLocalSearchParams<{ server?: string }>();
  const [advanced, setAdvanced] = useState(Boolean(linked));
  const [server, setServer] = useState(linked ?? defaultServer);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState(""); // the code, or App Review's password
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busy = status === "busy";
  // While typing, the picture steps aside so the field and its button sit just above the keyboard; a phone too short
  // even for that scrolls to them.
  const typing = useKeyboardUp();
  const page = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (!typing) return;
    const sub = Keyboard.addListener("keyboardDidShow", () => page.current?.scrollToEnd());
    return () => sub.remove();
  }, [typing]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const target = () => (advanced ? server.trim().replace(/\/+$/, "") : defaultServer);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const send = async () => {
    setProblem(null);
    if (!looksLikeEmail(email)) return setStatus("invalid");
    if (!/^https?:\/\/[^/\s]+/.test(target())) return setProblem(tr("notServer"));
    const again = step === "code";
    Keyboard.dismiss(); // down, so the envelope can be seen leaving and the email landing
    setStatus("busy");
    const result = await sendSignInCode(email, target());
    if (result === "password") {
      setSecret("");
      setStep("password");
      return setStatus("idle");
    }
    if (result === "sent") {
      setResendAt(Date.now() + RESEND_AFTER);
      setNow(Date.now());
      setSecret("");
      setStep("code");
      return setStatus(again ? "resent" : "idle");
    }
    setStatus(result);
  };
  const check = async (value: string) => {
    setStatus("busy");
    const result = await signInWithCode(email, step === "password" ? { password: value } : { code: value }, target());
    if (result === "ok") return router.replace("/welcome");
    setStatus(result);
  };
  const withKey = async () => {
    setProblem(null);
    setStatus("busy");
    try {
      if (await signInWithKey(target(), key)) return router.replace("/welcome");
      setProblem(tr("badKey"));
    } catch {
      setProblem(tr("unreachable", { origin: target() }));
    }
    setStatus("idle");
  };
  const restart = () => {
    setStep("email");
    setStatus("idle");
    setSecret("");
    setProblem(null);
  };

  const message = problem ?? {
    invalid: tr("invalid"), bad: tr(step === "password" ? "password.bad" : "code.bad"), spent: tr("code.spent"),
    limited: tr(step === "email" ? "limited" : "code.limited"), error: tr("error"),
  }[status as "invalid" | "bad" | "spent" | "limited" | "error"] ?? null;
  const field = [styles.field, font.regular, { borderColor: status === "invalid" ? t.danger : t.lineStrong, backgroundColor: t.surface, color: t.ink }];
  const useKey = advanced && key.trim().length > 0;
  const heading = step === "email" ? "title" : step === "code" ? "sent.title" : "password.title";
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView
        ref={page}
        alwaysBounceVertical={false} // still when it fits, as a sign-in screen should be
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
      >
        <Wordmark size={34} />
        <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" maxFontSizeMultiplier={scale.display} style={[font.display, styles.h1, { color: t.ink }]}>
            {tr.rich(heading, { accent: (c) => <Text style={{ color: t.accent }}>{c}</Text> })}
          </Text>
          <Text style={[font.regular, styles.lede, { color: t.ink2 }]}>
            {step === "email" ? tr("lede") : tr.rich(step === "code" ? "sent.lede" : "password.lede", { email: email.trim(), b: (c) => <Text style={[font.semibold, { color: t.ink }]}>{c}</Text> })}
          </Text>
        </View>

        {!advanced && step !== "password" && !typing && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <Story t={t} sent={step === "code"} sending={busy && step === "email"} />
          </Animated.View>
        )}
        {advanced && step === "email" && (
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

        {/* Everything to type and tap sits together at the bottom, in reach of a thumb and riding up with the keyboard. */}
        <View style={{ marginTop: "auto", gap: 12 }}>
          {step === "email" && (
            <View style={{ gap: 8 }}>
              <Text nativeID="email-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("email")}</Text>
              <TextInput value={email} onChangeText={(v) => { setEmail(v); if (status === "invalid") setStatus("idle"); }}
                autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
                placeholder={tr("emailPlaceholder")} placeholderTextColor={t.ink2} returnKeyType="send" editable={!busy}
                onSubmitEditing={() => void (useKey ? withKey() : send())}
                style={field} accessibilityLabel={tr("email")} accessibilityLabelledBy="email-label" />
            </View>
          )}
          {step === "code" && (
            <CodeField t={t} value={secret} label={tr("code.label")} a11y={tr("code.a11y")} invalid={status === "bad" || status === "spent"} busy={busy}
              onChange={(v) => {
                setSecret(v);
                if (status !== "busy") setStatus("idle");
                if (v.length === 6) void check(v);
              }} />
          )}
          {step === "password" && (
            <View style={{ gap: 8 }}>
              <Text nativeID="password-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{tr("password.label")}</Text>
              <TextInput value={secret} onChangeText={(v) => { setSecret(v); if (status === "bad") setStatus("idle"); }} autoFocus secureTextEntry
                textContentType="password" autoComplete="current-password" returnKeyType="go" editable={!busy} onSubmitEditing={() => void check(secret)}
                style={[styles.field, font.regular, { borderColor: status === "bad" ? t.danger : t.lineStrong, backgroundColor: t.surface, color: t.ink }]}
                accessibilityLabel={tr("password.label")} accessibilityLabelledBy="password-label" />
            </View>
          )}
          {busy && step === "code" && <Text accessibilityLiveRegion="polite" style={[font.regular, { color: t.ink2, fontSize: 15 }]}>{tr("code.checking")}</Text>}
          {message && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{message}</Text>}
          {status === "resent" && <Text accessibilityLiveRegion="polite" style={[font.regular, { color: t.ink2, fontSize: 15, lineHeight: 21 }]}>{tr("sent.another")}</Text>}
          <View style={{ gap: 8 }}>
            {step === "code" ? (
              <>
                <Pressable accessibilityRole="button" onPress={() => void Linking.openURL("message://").catch(() => {})}
                  style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 }]}>
                  <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("sent.openMail")}</Text>
                </Pressable>
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || wait > 0 }} disabled={busy || wait > 0} onPress={() => void send()} style={styles.quiet}>
                    <Text style={[font.medium, { color: wait > 0 ? t.ink2 : t.actionInk, fontSize: 15, fontVariant: ["tabular-nums"] }]}>
                      {wait > 0 ? tr("sent.wait", { seconds: wait }) : tr("sent.again")}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={restart} style={styles.quiet}>
                    <Text style={[font.medium, { color: t.actionInk, fontSize: 15 }]}>{tr("sent.different")}</Text>
                  </Pressable>
                </View>
                <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18, textAlign: "center" }]}>{tr("sent.spam")}</Text>
              </>
            ) : step === "password" ? (
              <>
                <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy || !secret }} disabled={busy || !secret} onPress={() => void check(secret)}
                  style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: busy || !secret ? 0.6 : pressed ? 0.85 : 1 }]}>
                  {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("password.signIn")}</Text>}
                </Pressable>
                <Pressable accessibilityRole="button" onPress={restart} style={styles.quiet}>
                  <Text style={[font.medium, { color: t.actionInk, fontSize: 15 }]}>{tr("sent.different")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void (useKey ? withKey() : send())}
                  style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
                  {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr(useKey ? "useKey" : "send")}</Text>}
                </Pressable>
                {(showServerChoice || linked) && (
                  <Pressable accessibilityRole="button" onPress={() => { setAdvanced((a) => !a); setProblem(null); if (advanced) setServer(defaultServer); }} style={styles.quiet}>
                    <Text style={[font.regular, { color: t.ink2, fontSize: 14, textDecorationLine: "underline" }]}>{advanced ? tr("useHost", { host: new URL(defaultServer).host }) : tr("ownServer")}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Six boxes over one field. The field does the typing, pasting and iOS's "From Mail" suggestion; the boxes only show it.
function CodeField({ t, value, label, a11y, invalid, busy, onChange }: { t: Palette; value: string; label: string; a11y: string; invalid: boolean; busy: boolean; onChange: (v: string) => void }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 1400); // after the email has landed and its tiles have lit once
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={{ gap: 8 }}>
      <Text nativeID="code-label" style={[font.medium, { color: t.ink, fontSize: 14 }]}>{label}</Text>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <View style={styles.boxes} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: 6 }, (_, i) => {
            const current = focused && !busy && i === Math.min(value.length, 5);
            return (
              <View key={i} style={[styles.box, { backgroundColor: t.surface, borderColor: invalid ? t.danger : current ? t.ink : t.lineStrong, borderWidth: current ? 2 : 1 }]}>
                <Text maxFontSizeMultiplier={1.4} style={[font.semibold, styles.digit, { color: busy ? t.ink2 : t.ink }]}>{value[i] ?? ""}</Text>
              </View>
            );
          })}
        </View>
        <TextInput ref={input} value={value} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
          editable={!busy} caretHidden onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
          style={styles.hiddenInput} accessibilityLabel={a11y} accessibilityLabelledBy="code-label" />
      </Pressable>
    </View>
  );
}

// The feature piece. Before sending: an empty slot with an envelope floating in it, waiting. Sending: the envelope
// lifts off. Sent: the email lands like a notification, and its six code tiles light up in turn, the way you read
// them. It never shows digits, so there is nothing to mistake for the real code. Reduce Motion keeps it still.
function Story({ t, sent, sending }: { t: Palette; sent: boolean; sending: boolean }) {
  const tr = useTranslations("ios.signin.story");
  return (
    <View accessible accessibilityLabel={sent ? tr("sentA11y") : tr("waitingA11y")}>
      {sent ? (
        <Animated.View key="sent" entering={FadeIn.duration(200)} style={{ gap: 10 }}>
          <Text style={[font.medium, { color: t.ink2, fontSize: 13 }]}>{tr("landed")}</Text>
          <CodeEmail t={t} />
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

// The email from Pluck: it drops in, then a highlight runs across its six tiles every three seconds.
const SWEEP = 3000;

function CodeEmail({ t }: { t: Palette }) {
  const tr = useTranslations("ios.signin.card");
  const reduced = useReducedMotion();
  const arrive = useSharedValue(reduced ? 1 : 0);
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    arrive.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    clock.value = withRepeat(withTiming(SWEEP, { duration: SWEEP, easing: Easing.linear }), -1);
  }, [reduced, arrive, clock]);
  const card = useAnimatedStyle(() => ({ opacity: arrive.value, transform: [{ translateY: (1 - arrive.value) * -24 }, { scale: 0.97 + arrive.value * 0.03 }] }));
  return (
    <Animated.View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }, card]}>
      <View style={[styles.panelHead, { borderBottomColor: t.line }]}>
        <Text style={[font.semibold, { color: t.ink, fontSize: 13 }]}>Pluck</Text>
        <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink2, fontSize: 13 }]}>{tr("subject")}</Text>
        <Text style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{tr("now")}</Text>
      </View>
      <View style={styles.panelBody}>
        <View style={styles.tiles}>
          {Array.from({ length: 6 }, (_, i) => <Tile key={i} t={t} index={i} clock={clock} still={reduced} />)}
        </View>
        <Text style={[font.regular, { color: t.ink2, fontSize: 14, lineHeight: 20 }]}>{tr("body")}</Text>
      </View>
    </Animated.View>
  );
}

function Tile({ t, index, clock, still }: { t: Palette; index: number; clock: SharedValue<number>; still: boolean }) {
  const lit = useAnimatedStyle(() => {
    const at = 300 + index * 220; // each tile's moment in the sweep
    const d = Math.abs(clock.value - at);
    return { opacity: still ? 0 : Math.max(0, 1 - d / 260) };
  });
  return (
    <View style={[styles.tile, { backgroundColor: t.tint }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 8, backgroundColor: t.highlightWash }, lit]} />
      <View style={[styles.tileBar, { backgroundColor: t.lineStrong }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 24 },
  slot: { height: 168, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  panel: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, shadowColor: "#151A13", shadowOpacity: 0.1, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  panelBody: { gap: 12, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 18 },
  tiles: { flexDirection: "row", gap: 6 },
  tile: { width: 34, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileBar: { width: 12, height: 3, borderRadius: 2 },
  boxes: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 60, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  digit: { fontSize: 26, fontVariant: ["tabular-nums"] },
  hiddenInput: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.02, color: "transparent" },
  h1: { fontSize: 46, lineHeight: 46, letterSpacing: -1.6, paddingTop: 4 },
  lede: { fontSize: 16, lineHeight: 23 },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  row: { flexDirection: "row", justifyContent: "center", gap: 24 },
  quiet: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
