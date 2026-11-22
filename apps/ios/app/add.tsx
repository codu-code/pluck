import { extractUrls, TEXT_KINDS, type TextKind } from "@pluck/shared-schemas";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon, ICONS, KindGlyph } from "@/components/Glyph";
import { Hearing, Mic, spoken, useSpeak } from "@/components/Speak";
import { shown, useColumns } from "@/components/split/context";
import { toast } from "@/components/Toast";
import { library, pluck, pluckPhoto } from "@/lib/data";
import { font, scale, useTheme } from "@/lib/theme";

// The web's Pluck box as a sheet: one link, a block of links, or a sentence that becomes a Note, Todo or Thing.
// A link on the clipboard goes in with iOS's own Paste button, which asks no "Allow Paste?" question.
export default function Add() {
  return useColumns().wide ? <AddWide /> : <AddSheet />;
}

type Shot = ImagePicker.ImagePickerAsset;

// A picture comes from where it is: out of the photo library (iOS's own picker, which needs no permission and hands
// over only what is picked) or straight from the camera. It goes into the box first (Shots), as in Messages: there
// to be seen, and to have a note written or spoken under it, before it is plucked.
// JPEGs at 0.6: a full-size photo then fits what an AI tool can be handed (the connector's 3 MB).
// `note` (iPhone): a Note button beside them, which leaves the sheet for a new Note's own editor.
function Photos({ busy, onPick, setError, note = false }: { busy: boolean; onPick: (shots: Shot[]) => void; setError: (e: string | null) => void; note?: boolean }) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const take = async (from: "library" | "camera") => {
    if (busy) return;
    setError(null);
    if (from === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return setError(tr("add.cameraOff"));
    const picked = from === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 10 });
    if (!picked.canceled && picked.assets.length) onPick(picked.assets);
  };
  return (
    <View style={styles.photos}>
      {([...(note ? ["note" as const] : []), "library", "camera"] as const).map((from) => (
        <Pressable key={from} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
          onPress={() => (from === "note" ? router.replace("/items/new") : void take(from))}
          style={({ pressed }) => [styles.photo, { borderColor: t.lineStrong, backgroundColor: pressed ? t.tint : "transparent", opacity: busy ? 0.6 : 1 }]}>
          <Icon d={from === "note" ? ICONS.compose : from === "library" ? ICONS.photo : ICONS.camera} size={18} color={t.ink} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={scale.title} style={[font.medium, { flexShrink: 1, color: t.ink, fontSize: 15 }]}>{tr(from === "note" ? "kinds.note" : from === "library" ? "add.photo" : "add.camera")}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// The pictures waiting in the box: each as it is, with a way to take it out again.
function Shots({ shots, busy, remove }: { shots: Shot[]; busy: boolean; remove: (shot: Shot) => void }) {
  const t = useTheme();
  const tr = useTranslations("ios.add");
  return (
    <View style={styles.shots}>
      {shots.map((a) => (
        <View key={a.uri}>
          <Image source={{ uri: a.uri }} accessible accessibilityRole="image" accessibilityLabel={tr("photo")} accessibilityIgnoresInvertColors style={[styles.shot, { backgroundColor: t.rail }]} />
          {!busy && (
            <Pressable accessibilityRole="button" accessibilityLabel={tr("removePhoto")} onPress={() => remove(a)} hitSlop={12} style={[styles.out, { backgroundColor: t.ink }]}>
              <Icon d={ICONS.close} size={10} color={t.ground} width={2} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

// Each picture becomes an Image, like one from the share sheet, and what was written is the note on each. One that is
// up leaves the box (`gone`), so trying again after a failure sends only the rest.
// shortcut: the note is a second request (the file route takes none); if only that one fails, trying again plucks the picture twice. Let the route take a note if it happens.
async function pluckShots(shots: Shot[], note: string, gone: (shot: Shot) => void) {
  for (const a of shots) {
    const item = await pluckPhoto(a.uri, a.fileName ?? "Photo", a.mimeType);
    if (note) await library.edit(item.id, { note });
    gone(a);
  }
}

function AddSheet() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<TextKind>("note");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); // a link is on the clipboard (asking does not read it)
  useEffect(() => void Clipboard.hasUrlAsync().then(setCopied).catch(() => {}), []);
  const speak = useSpeak((words) => setValue((was) => spoken(was, words)), setError);
  const [shots, setShots] = useState<Shot[]>([]); // pictures picked: what is typed is then their note
  const drop = (shot: Shot) => setShots((was) => was.filter((x) => x !== shot));

  const text = value.trim();
  const isText = Boolean(text) && extractUrls(text).length === 0;
  const words = isText || shots.length > 0; // a sentence, not a link: the keyboard for writing
  const ready = Boolean(text) || shots.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { queued } = shots.length ? (await pluckShots(shots, text, drop), { queued: false }) : await pluck(isText ? { text, kind } : { text }); // offline, it waits in the queue
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      toast(tr(queued ? "add.queued" : "add.plucked"));
    } catch {
      setError(tr("add.failed"));
      setBusy(false);
    }
  };

  return (
    // No title and no Cancel: the sheet is Pluck's own, and it goes away as iOS sheets do, pulled down by its grabber
    // or by a tap outside it. VoiceOver's scrub does the same.
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.ground }} onAccessibilityEscape={() => router.back()}>
      <View style={styles.body}>
        <View style={[styles.field, { borderColor: t.lineStrong, backgroundColor: t.surface }]}>
          {shots.length > 0 && <View style={styles.inBox}><Shots shots={shots} busy={busy} remove={drop} /></View>}
          <TextInput
            value={value}
            onChangeText={(v) => { setValue(v); setError(null); }}
            placeholder={shots.length ? tr("note.placeholder") : tr("add.placeholder")}
            placeholderTextColor={t.ink2}
            accessibilityLabel={shots.length ? tr("note.title") : tr("add.placeholder")}
            multiline
            autoFocus
            autoCapitalize={shots.length ? "sentences" : "none"}
            autoCorrect={words}
            keyboardType={words ? "default" : "url"}
            textContentType="none"
            selectionColor={t.accent}
            style={[font.regular, styles.words, { color: t.ink }]}
          />
          <View style={styles.foot}><Hearing speak={speak} /><Mic speak={speak} /></View>
        </View>
        {copied && !ready && (
          <Clipboard.ClipboardPasteButton
            acceptedContentTypes={["url", "plain-text"]}
            onPress={(data) => { if (data.type === "text") setValue(data.text); }}
            backgroundColor={t.brand}
            foregroundColor={t.onBrand}
            cornerStyle="capsule"
            displayMode="iconAndLabel"
            style={styles.paste}
          />
        )}
        {!ready && !speak.on && <Photos busy={busy} onPick={setShots} setError={setError} note />}
        {isText && !shots.length && (
          // Text with no link: which Kind it becomes, as the web box asks.
          <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel={tr("add.as")}>
            <Text style={[font.regular, { color: t.ink2, fontSize: 14 }]}>{tr("add.as")}</Text>
            {TEXT_KINDS.map((k) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)}
                style={[styles.chip, kind === k ? { backgroundColor: t.brand, borderColor: t.brand } : { borderColor: t.lineStrong }]}>
                <Text style={[font.regular, { fontSize: 14, color: kind === k ? t.onBrand : t.ink }]}>{tr(`kinds.${k}`)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {error && <Text accessibilityRole="alert" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={() => void submit()}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.brand, opacity: !ready || busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 16 }]}>{tr("add.submit")}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// iPad (iPad-Add): the form sheet with Link, Note, Todo and Thing on top, a title and the words for a Note, Todo
// or Thing, and the keys that pluck and cancel. Tags, a List and a Status are set after, from the Item: a pluck made
// with no connection waits in a queue that only knows how to make the Item.
type Mode = "link" | TextKind;
const MODES: Mode[] = ["link", ...TEXT_KINDS];

function AddWide() {
  const t = useTheme();
  const tr = useTranslations("ios");
  const asked = useLocalSearchParams<{ kind?: string }>().kind; // ⌘N and ⌘⇧N open on a Note or a Todo
  const [mode, setMode] = useState<Mode>(MODES.includes(asked as Mode) ? (asked as Mode) : "link");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speak = useSpeak((words) => setValue((was) => spoken(was, words)), setError);
  const [picked, setShots] = useState<Shot[]>([]);
  const shots = mode === "link" ? picked : []; // pictures go in from Link, where Photo and Camera are
  const drop = (shot: Shot) => setShots((was) => was.filter((x) => x !== shot));
  const text = value.trim();
  const ready = Boolean(text || shots.length || (mode !== "link" && title.trim()));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = mode === "link" ? { text } : { text: text || title.trim(), kind: mode, ...(title.trim() && text ? { title: title.trim() } : {}) };
      const { queued } = shots.length ? (await pluckShots(shots, text, drop), { queued: false }) : await pluck(body);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      toast(tr(queued ? "add.queued" : "add.plucked"));
    } catch {
      setError(tr("add.failed"));
      setBusy(false);
    }
  };

  // ⌘↩ plucks from here (components/split/Shortcuts.tsx); the latest submit, so it sends what is typed now.
  const latest = useRef(submit);
  latest.current = submit;
  useEffect(() => {
    shown.sheet = { submit: () => void latest.current() };
    return () => void (shown.sheet = null);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <View style={[wide.head, { borderBottomColor: t.line }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.actionInk, fontSize: 16 }]}>{tr("common.cancel")}</Text>
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>
          {mode === "link" ? tr("add.title") : tr("ipad.add.new", { kind: mode })}
        </Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={() => void submit()}
          style={({ pressed }) => [wide.pluck, { backgroundColor: t.brand, opacity: !ready || busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          {busy ? <ActivityIndicator color={t.onBrand} /> : <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.onBrand, fontSize: 15 }]}>{tr("ipad.add.pluck")}</Text>}
        </Pressable>
      </View>
      <View style={wide.body}>
        <View style={[wide.segments, { backgroundColor: t.chip }]} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => setMode(m)}
              style={[wide.segment, mode === m && { backgroundColor: t.surface }]}>
              <KindGlyph kind={m} size={14} color={t.ink} />
              <Text maxFontSizeMultiplier={scale.title} style={[mode === m ? font.semibold : font.regular, { color: t.ink, fontSize: 14 }]}>{m === "link" ? tr("ipad.add.link") : tr(`kinds.${m}`)}</Text>
            </Pressable>
          ))}
        </View>
        {mode !== "link" && (
          <TextInput value={title} onChangeText={setTitle} placeholder={tr("ipad.add.titlePlaceholder")} placeholderTextColor={t.ink2} accessibilityLabel={tr("item.titleA11y")}
            selectionColor={t.accent} style={[font.bold, { color: t.ink, fontSize: 24, letterSpacing: -0.24 }]} />
        )}
        {shots.length > 0 && <Shots shots={shots} busy={busy} remove={drop} />}
        <TextInput
          value={value}
          onChangeText={(v) => { setValue(v); setError(null); }}
          placeholder={shots.length ? tr("note.placeholder") : mode === "link" ? tr("add.placeholder") : tr("item.textPlaceholder")}
          placeholderTextColor={t.ink2}
          accessibilityLabel={shots.length ? tr("note.title") : mode === "link" ? tr("add.placeholder") : tr("item.textA11y")}
          multiline
          autoFocus
          autoCapitalize={mode === "link" && !shots.length ? "none" : "sentences"}
          autoCorrect={mode !== "link" || shots.length > 0}
          keyboardType={mode === "link" && !shots.length ? "url" : "default"}
          selectionColor={t.accent}
          style={[font.regular, wide.words, { color: t.ink }]}
        />
        <View style={styles.foot}><Hearing speak={speak} /><Mic speak={speak} /></View>
        {mode === "link" && !ready && !speak.on && <Photos busy={busy} onPick={setShots} setError={setError} />}
        {error && <Text accessibilityRole="alert" style={[font.regular, { color: t.danger, fontSize: 15, lineHeight: 21 }]}>{error}</Text>}
        <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>
          {tr.rich("ipad.add.keys", { key: (c) => <View style={[wide.key, { borderColor: t.lineStrong }]}><Text maxFontSizeMultiplier={scale.badge} style={[font.regular, { color: t.ink2, fontSize: 12 }]}>{c}</Text></View> })}
        </Text>
      </View>
    </View>
  );
}

const wide = StyleSheet.create({
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  pluck: { height: 34, paddingHorizontal: 16, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  body: { paddingVertical: 18, paddingHorizontal: 20, gap: 16 },
  segments: { flexDirection: "row", padding: 3, borderRadius: 10 },
  segment: { flex: 1, height: 32, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  words: { fontSize: 17, lineHeight: 27, minHeight: 150, maxHeight: 320, textAlignVertical: "top" },
  key: { minWidth: 22, height: 22, paddingHorizontal: 6, borderWidth: 1, borderBottomWidth: 2, borderRadius: 6, alignItems: "center", justifyContent: "center", transform: [{ translateY: 5 }] },
});

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 28, gap: 12 }, // under the grabber
  field: { borderWidth: 1, borderRadius: 12 },
  words: { minHeight: 64, maxHeight: 180, paddingHorizontal: 14, paddingTop: 12, fontSize: 17, textAlignVertical: "top" },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 2, minHeight: 44 }, // what is being heard, and the microphone
  inBox: { paddingHorizontal: 14, paddingTop: 14 },
  shots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shot: { width: 72, height: 72, borderRadius: 10 },
  out: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  paste: { alignSelf: "flex-start", height: 40, width: 120 },
  photos: { flexDirection: "row", gap: 8 },
  photo: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, // three across: "Appareil photo" has to fit
  kinds: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: "center" },
  primary: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
});
