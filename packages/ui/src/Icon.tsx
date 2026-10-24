// Ported from design/Icon.dc.html. The geometry lives in icon.json, shared with scripts/icons.mjs.
import icon from "./icon.json" with { type: "json" };

type Tone = keyof typeof icon.tones;
type IconProps = { size?: number; tone?: Tone };

/** The glyph's size inside a tile of `size`, and which drawing to use (the small one is heavier, two sparks). */
export function iconGlyph(size: number, tone: Tone) {
  const t = icon.tones[tone];
  const s = icon.glyphScale;
  const glyph = t.tile ? Math.round(size * (size <= s.tinyTileAt ? s.tinyTile : s.tile)) : size;
  return { glyph, g: glyph <= icon.smallAt ? icon.glyph.small : icon.glyph.large };
}

export function Icon({ size = 128, tone = "forest" }: IconProps) {
  const t = icon.tones[tone];
  const { glyph, g } = iconGlyph(size, tone);
  return (
    <span
      role="img"
      aria-label="Pluck"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        boxSizing: "border-box",
        width: size,
        height: size,
        borderRadius: t.tile ? Math.round(size * icon.radius) : 0,
        background: t.bg,
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" style={{ width: glyph, height: glyph, overflow: "visible" }}>
        <path d={g.stem} fill="none" stroke={t.ink} strokeWidth={g.stemWidth} strokeLinecap="round" />
        <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={t.ink} strokeWidth={g.ringWidth} />
        <path d={g.sparks} fill="none" stroke={t.spark} strokeWidth={g.sparkWidth} strokeLinecap="round" />
      </svg>
    </span>
  );
}
