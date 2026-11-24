import * as Haptics from "expo-haptics";
import { getLocales } from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslations } from "use-intl";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";
import { toast } from "./Toast";

export type Speaking = { on: boolean; hearing: string; toggle: () => void };

// Speaking in place of typing, wherever words are written: the Add box, a Note, the note on a link. It is the
// iPhone's own speech recognition: on the phone where the phone can do the language itself, else through Apple, where
// the keyboard's dictation already sends it. Pluck keeps no sound: what comes out is text. Each stretch of speech is
// handed over when it has settled; `hearing` is the stretch still being heard. `refuse` says why it would not start,
// where the screen can show it (a sheet covers the toast).
export function useSpeak(insert: (words: string) => void, refuse: (why: string) => void = toast): Speaking {
  const tr = useTranslations("ios.speak");
  const [on, setOn] = useState(false);
  const [hearing, setHearing] = useState("");
  const mine = useRef(false); // this field started it: two can be on screen (iPad's Add over an open Note)
  const pending = useRef("");
  const latest = useRef({ insert, refuse });
  latest.current = { insert, refuse };

  const settle = (words: string) => {
    pending.current = "";
    setHearing("");
    if (words.trim()) latest.current.insert(words.trim());
  };
  const off = () => {
    mine.current = false;
    setOn(false);
  };
  useSpeechRecognitionEvent("result", (e) => {
    if (!mine.current) return;
    const said = e.results[0]?.transcript ?? "";
    if (e.isFinal) return settle(said);
    pending.current = said;
    setHearing(said);
  });
  useSpeechRecognitionEvent("end", () => {
    if (!mine.current) return;
    settle(pending.current); // stopped mid-sentence: what was heard so far is kept
    off();
  });
  useSpeechRecognitionEvent("error", (e) => {
    if (!mine.current || e.error === "aborted" || e.error === "no-speech") return; // silence is not a failure
    latest.current.refuse(tr("off"));
    off();
  });
  useEffect(() => () => void (mine.current && ExpoSpeechRecognitionModule.abort()), []); // the screen went away

  const toggle = async () => {
    if (on) {
      void Haptics.selectionAsync();
      return ExpoSpeechRecognitionModule.stop();
    }
    if (!(await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted) return refuse(tr("denied"));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mine.current = true;
    setOn(true);
    ExpoSpeechRecognitionModule.start({
      lang: getLocales()[0]?.languageTag ?? "en-US",
      interimResults: true,
      continuous: true, // until Stop: a pause to think does not end it
      requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(), // off the phone only where it cannot
      addsPunctuation: true,
    });
  };
  return { on, hearing, toggle: () => void toggle() };
}

// Spoken words after typed ones in a plain field, a space between.
export const spoken = (text: string, words: string) => (text && !/\s$/.test(text) ? `${text} ${words}` : text + words);

// The microphone: tap to speak, tap again (now a stop mark on Pluck green) to stop.
export function Mic({ speak }: { speak: Speaking }) {
  const t = useTheme();
  const tr = useTranslations("ios.speak");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr(speak.on ? "stop" : "start")} onPress={speak.toggle}
      style={({ pressed }) => [styles.mic, speak.on ? { backgroundColor: t.brand } : pressed && { backgroundColor: t.railActive }]}>
      <Icon d={speak.on ? ICONS.stop : ICONS.mic} size={20} color={speak.on ? t.onBrand : t.ink} />
    </Pressable>
  );
}

// What is being heard, beside the microphone while it listens: the end of the sentence stays in view.
export function Hearing({ speak }: { speak: Speaking }) {
  const t = useTheme();
  const tr = useTranslations("ios.speak");
  return (
    <Text numberOfLines={1} ellipsizeMode="head" maxFontSizeMultiplier={scale.title} style={[font.regular, styles.hearing, { color: t.ink2 }]}>
      {speak.on ? speak.hearing || tr("listening") : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  hearing: { flex: 1, fontSize: 15, lineHeight: 21 },
});
