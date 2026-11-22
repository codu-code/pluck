import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { EnrichedMarkdownTextInput, type CaretRect, type EnrichedMarkdownTextInputInstance, type HeadingLevel, type StyleState } from "react-native-enriched-markdown";
import { sameNote } from "@pluck/shared-schemas";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { font, scale, useTheme } from "@/lib/theme";
import { Icon, ICONS } from "./Glyph";

export type Format = Pick<StyleState, "bold" | "italic" | "heading" | "unorderedList" | "orderedList">;
export type RichTextHandle = Pick<EnrichedMarkdownTextInputInstance, "toggleBold" | "toggleItalic" | "toggleUnorderedList" | "toggleOrderedList" | "focus"> & {
  heading: () => void; // body, then a heading, then a smaller one, then body again
};

type Props = {
  value: string; // the Note's text as it is kept: Markdown (docs/adr/0002). Read once, when the editor opens.
  onChange: (markdown: string) => void;
  onFormat: (state: Format) => void;
  onFocus: () => void;
  onBlur: () => void;
  onCaret: (rect: CaretRect) => void;
  // The editor could not read this text back as it was written: the caller shows the plain editor instead.
  onUnfit: () => void;
  placeholder: string;
  a11y: string;
};

// The words of a Note, Todo or Thing as rich text: bold, italic, two heading sizes, bullets and numbers, with no marks
// showing. What it keeps is Markdown, a line a block, exactly as a plain Note was always kept, so an old Note opens
// unchanged. It never writes until it has read the text back the same, and so never rewrites one it cannot keep.
export const RichText = forwardRef<RichTextHandle, Props>(function RichText({ value, onChange, onFormat, onFocus, onBlur, onCaret, onUnfit, placeholder, a11y }, handle) {
  const t = useTheme();
  const tr = useTranslations("ios.format");
  const input = useRef<EnrichedMarkdownTextInputInstance>(null);
  const first = useRef(value);
  const fits = useRef(false);
  const level = useRef<0 | HeadingLevel>(0);

  useEffect(() => {
    let live = true;
    void input.current?.getMarkdown().then((read) => {
      if (!live) return;
      if (sameNote(read, first.current)) fits.current = true;
      else onUnfit();
    });
    return () => void (live = false);
  }, []); // once: the text as it opened

  useImperativeHandle(handle, () => ({
    toggleBold: () => input.current?.toggleBold(),
    toggleItalic: () => input.current?.toggleItalic(),
    toggleUnorderedList: () => input.current?.toggleUnorderedList(),
    toggleOrderedList: () => input.current?.toggleOrderedList(),
    focus: () => input.current?.focus(),
    // Toggling the level a line already has takes the heading off, so each step names the level it goes to.
    heading: () => input.current?.toggleHeading(level.current === 0 ? 1 : level.current === 1 ? 2 : level.current),
  }), []);

  return (
    <EnrichedMarkdownTextInput
      ref={input}
      defaultValue={value}
      scrollEnabled={false} // the screen scrolls, the title with it; onCaret keeps the line being typed in view
      markdownShortcuts
      placeholder={placeholder}
      placeholderTextColor={t.ink2}
      accessibilityLabel={a11y}
      cursorColor={t.accent}
      selectionColor={t.accent}
      onChangeMarkdown={(md) => { if (fits.current) onChange(md); }}
      onChangeState={(s) => {
        level.current = s.heading.isActive ? s.heading.level : 0;
        onFormat(s);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      // Where the caret is, asked for each time it moves: the library's own onCaretRectChange never fires on iOS (1.2.0).
      onChangeSelection={() => void input.current?.getCaretRect().then(onCaret, () => {})}
      // Only what the bar offers: what a Note keeps is what every surface can show.
      selectionMenuConfig={{ format: { label: tr("title") }, copyAsMarkdown: { enabled: false } }}
      formatMenuConfig={{
        bold: { label: tr("bold") }, italic: { label: tr("italic") },
        underline: { enabled: false }, strikethrough: { enabled: false }, spoiler: { enabled: false }, link: { enabled: false },
      }}
      markdownStyle={{
        link: { color: t.actionInk },
        h1: { fontSize: 22, fontWeight: "700", color: t.ink }, h2: { fontSize: 19, fontWeight: "600", color: t.ink },
        h3: { fontSize: 17, fontWeight: "600", color: t.ink }, h4: { fontSize: 17, fontWeight: "600", color: t.ink },
        h5: { fontSize: 17, fontWeight: "600", color: t.ink }, h6: { fontSize: 17, fontWeight: "600", color: t.ink },
        list: { itemSpacing: 4 },
      }}
      style={[font.regular, { color: t.ink, fontSize: 17, lineHeight: 25, minHeight: 300 }]}
    />
  );
});

// The bar over the keyboard while the words are being written: Bold, Italic, Heading, Bullets, Numbers, and Done,
// which puts the keyboard away. On the rail, like the reader's toolbar it stands in for.
export function FormatBar({ input, format, keyboard }: { input: React.RefObject<RichTextHandle | null>; format: Format | null; keyboard: boolean }) {
  const t = useTheme();
  const tr = useTranslations("ios");
  const bottom = useSafeAreaInsets().bottom;
  const heading = format?.heading.isActive ? format.heading.level : 0;
  const tools = [
    { key: "bold", on: format?.bold.isActive, press: () => input.current?.toggleBold(), mark: <Text maxFontSizeMultiplier={scale.bar} style={[font.bold, styles.letter, { color: t.ink }]}>B</Text> },
    { key: "italic", on: format?.italic.isActive, press: () => input.current?.toggleItalic(), mark: <Text maxFontSizeMultiplier={scale.bar} style={[font.reader, styles.letter, { color: t.ink, fontStyle: "italic" }]}>I</Text> },
    { key: "heading", on: heading > 0, press: () => input.current?.heading(), mark: <Text maxFontSizeMultiplier={scale.bar} style={[font.semibold, styles.letter, { color: t.ink }]}>H{heading === 2 ? <Text style={styles.sub}>2</Text> : null}</Text> },
    { key: "bullets", on: format?.unorderedList.isActive, press: () => input.current?.toggleUnorderedList(), mark: <Icon d={ICONS.lists} size={20} color={t.ink} /> },
    { key: "numbers", on: format?.orderedList.isActive, press: () => input.current?.toggleOrderedList(), mark: <Icon d={ICONS.numbered} size={20} color={t.ink} /> },
  ] as const;
  return (
    // With no keyboard on screen (a hardware one, on iPad) the bar sits at the foot of the column, over the home bar.
    <View style={[styles.bar, { backgroundColor: t.rail, borderTopColor: t.line, paddingBottom: keyboard ? 6 : Math.max(bottom, 6) }]} accessibilityRole="toolbar">
      {tools.map((x) => (
        <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={tr(`format.${x.key}`)} accessibilityState={{ selected: Boolean(x.on) }} onPress={x.press}
          style={({ pressed }) => [styles.tool, (x.on || pressed) && { backgroundColor: t.railActive }]}>
          {x.mark}
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={styles.done} hitSlop={4}>
        <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.actionInk, fontSize: 16 }]}>{tr("common.done")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  tool: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  letter: { fontSize: 19, lineHeight: 24 },
  sub: { fontSize: 12 },
  done: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
});
