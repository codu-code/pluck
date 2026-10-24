import tokens from "./tokens.json" with { type: "json" };

// Data enum (shared-schemas) → glyph and UI name. "link" shows as Read, "video" as Watch.
const GLYPH_KEY = { link: "read", video: "watch", pdf: "pdf", image: "image", note: "note", todo: "todo", thing: "thing" } as const;
export type Kind = keyof typeof GLYPH_KEY;
export const KIND_NAMES: Record<Kind, string> = {
  link: "Read", video: "Watch", pdf: "PDF", image: "Image", note: "Note", todo: "Todo", thing: "Thing",
};

export function KindGlyph({ kind, size = 16 }: { kind: Kind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={KIND_NAMES[kind]}>
      <path
        d={tokens.kindGlyphs16[GLYPH_KEY[kind]]}
        fill="none"
        stroke="currentColor"
        strokeWidth={tokens.glyphStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
