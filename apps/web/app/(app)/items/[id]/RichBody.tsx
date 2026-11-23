"use client";

import { sameNote } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { EnrichedMarkdownTextInput, type EnrichedMarkdownTextInputInstance, type StyleState } from "react-native-enriched-markdown/lib/module/EnrichedMarkdownTextInput.web.js";
import styles from "./note.module.css";

type Props = {
  text: string; // the Note's text as it is kept: Markdown (docs/adr/0002). Read once, when the editor opens.
  label: string;
  autoFocus: boolean;
  onChange: (markdown: string) => void;
  // The editor could not read this text back as it was written: the caller shows the plain editor instead.
  onUnfit: () => void;
};

// The words of a Note, Todo or Thing as rich text, with the bar the iPhone has: Bold, Italic, Heading, Bullets,
// Numbers. The same editor as the iPhone's (its web build), so both keep a Note the same way. It never writes until
// it has read the text back the same (sameNote), and so never rewrites a Note it cannot keep.
export default function RichBody({ text, label, autoFocus, onChange, onUnfit }: Props) {
  const t = useTranslations("app.note.format");
  const input = useRef<EnrichedMarkdownTextInputInstance>(null);
  const first = useRef(text);
  const fits = useRef(false);
  const [format, setFormat] = useState<StyleState | null>(null);

  useEffect(() => {
    let live = true;
    // A read that fails is a text it cannot keep, too: without this the editor would sit there writing nothing.
    void input.current?.getMarkdown().then((read) => {
      if (!live) return;
      if (sameNote(read, first.current)) fits.current = true;
      else onUnfit();
    }, () => live && onUnfit());
    return () => void (live = false);
  }, []); // once: the text as it opened

  const heading = format?.heading.isActive ? format.heading.level : 0;
  const tools = [
    { key: "bold", on: format?.bold.isActive, press: () => input.current?.toggleBold(), mark: <b>B</b> },
    { key: "italic", on: format?.italic.isActive, press: () => input.current?.toggleItalic(), mark: <i>I</i> },
    // Body, then a heading, then a smaller one, then body again (toggling the level a line has takes it off).
    { key: "heading", on: heading > 0, press: () => input.current?.toggleHeading(heading === 0 ? 1 : heading === 1 ? 2 : heading), mark: <>H{heading === 2 ? <sub>2</sub> : null}</> },
    { key: "bullets", on: format?.unorderedList.isActive, press: () => input.current?.toggleUnorderedList(), mark: <Glyph d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" /> },
    { key: "numbers", on: format?.orderedList.isActive, press: () => input.current?.toggleOrderedList(), mark: <Glyph d="M6.5 4h7M6.5 8h7M6.5 12h7M2 3l1-.6v3.2M1.9 10.2c.3-.6 1.6-.7 1.6.2 0 .7-1.1 1.2-1.7 2.2h1.9" /> },
  ] as const;

  return (
    <>
      <div role="toolbar" aria-label={t("title")} className={styles.tools}>
        {tools.map((x) => (
          // mousedown is refused so the click leaves the caret where it is in the words.
          <button key={x.key} type="button" className={styles.tool} aria-label={t(x.key)} title={t(x.key)} aria-pressed={Boolean(x.on)} onMouseDown={(e) => e.preventDefault()} onClick={x.press}>
            {x.mark}
          </button>
        ))}
      </div>
      <EnrichedMarkdownTextInput
        ref={input}
        defaultValue={text}
        autoFocus={autoFocus}
        aria-label={label}
        className={styles.rich}
        onChangeMarkdown={(md) => { if (fits.current) onChange(md); }}
        onChangeState={setFormat}
        markdownStyle={HEADINGS}
      />
    </>
  );
}

// Two sizes of heading, in the ink of the theme (the editor's own default is a fixed dark, lost on the dark ground).
// Levels past the second are an AI tool's doing: kept, and shown as the smaller one's weight at the text's size.
const heading = (fontSize: number) => ({ fontSize, fontWeight: "600", color: "var(--ink)" });
const HEADINGS = { h1: heading(28), h2: heading(22), h3: heading(18), h4: heading(18), h5: heading(18), h6: heading(18) };

// The two list marks, as packages/ui draws its 16-unit icons.
const Glyph = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
