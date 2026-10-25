import tokens from "./tokens.json" with { type: "json" };

// Data enum (shared-schemas) → glyph. The caller passes the Kind's name in the reader's language ("link" is Read, "video" Watch).
const GLYPH_KEY = { link: "read", video: "watch", pdf: "pdf", image: "image", note: "note", todo: "todo", thing: "thing" } as const;
export type Kind = keyof typeof GLYPH_KEY;

export function KindGlyph({ kind, label, size = 16 }: { kind: Kind; label: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={label}>
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
