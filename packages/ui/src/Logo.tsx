// Ported from design/Logo.dc.html. Values copied exactly.
// "auto" follows the theme through --logo-ink and --logo-spark (brand in light, onDark in dark).
type LogoProps = { size?: number; tone?: "auto" | "brand" | "onDark" };
const TONES = {
  auto: { ink: "var(--logo-ink)", spark: "var(--logo-spark)" },
  brand: { ink: "#1E5C45", spark: "#34A07C" },
  onDark: { ink: "#ECEFE8", spark: "#7FD3AE" },
};

export function Logo({ size = 96, tone = "auto" }: LogoProps) {
  const t = TONES[tone];
  return (
    <span
      role="img"
      aria-label="pluck"
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        fontFamily: "var(--font-fredoka), var(--font-geist), ui-rounded, sans-serif",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        lineHeight: 0.92,
        whiteSpace: "nowrap",
        fontSize: size,
        color: t.ink,
      }}
    >
      <span aria-hidden="true">pluck</span>
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        style={{ width: "0.457em", height: "0.457em", flex: "none", overflow: "visible", marginLeft: "-0.098em", marginTop: "0.022em" }}
      >
        <path
          d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85"
          fill="none"
          stroke={t.spark}
          strokeWidth={size >= 80 ? 1.8 : 2}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
