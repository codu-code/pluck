// Ported from design/Icon.dc.html. Values copied exactly.
const TONES = {
  forest: { bg: "#1E5C45", ink: "#F6F8F4", spark: "#7FD3AE", tile: true },
  mint: { bg: "#7FD3AE", ink: "#1E5C45", spark: "#151A13", tile: true },
  dark: { bg: "#10130F", ink: "#ECEFE8", spark: "#7FD3AE", tile: true },
  bare: { bg: "transparent", ink: "#1E5C45", spark: "#34A07C", tile: false },
  bareOnDark: { bg: "transparent", ink: "#ECEFE8", spark: "#7FD3AE", tile: false },
} as const;

type IconProps = { size?: number; tone?: keyof typeof TONES };

export function Icon({ size = 128, tone = "forest" }: IconProps) {
  const t = TONES[tone];
  const glyph = t.tile ? Math.round(size * (size <= 20 ? 0.84 : 0.66)) : size;
  const small = glyph <= 16;
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
        borderRadius: t.tile ? Math.round(size * 0.22) : 0,
        background: t.bg,
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" style={{ width: glyph, height: glyph, overflow: "visible" }}>
        <path d="M6 8.2v10" fill="none" stroke={t.ink} strokeWidth={small ? 4.6 : 4} strokeLinecap="round" />
        <circle cx="10" cy="10.6" r="3.5" fill="none" stroke={t.ink} strokeWidth={small ? 4 : 3.4} />
        <path
          d={small ? "M15.1 5.4L16.9 3.6M16.4 8.6L18.8 8.2" : "M15.3 5.3L16.7 3.9M16.6 8.3L18.4 8M12.8 3.2L13 1.8"}
          fill="none"
          stroke={t.spark}
          strokeWidth={small ? 2.8 : 2.2}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
