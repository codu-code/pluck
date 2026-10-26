import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { HOST } from "./origin";

// Link previews (Open Graph and X cards) for every page, in the brand: Fredoka for the wordmark and headline,
// Geist for the rest, the forest ground of the App Store boards (or the light ground for a public List).
export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  forest: { ground: "#1E5C45", ink: "#F6F8F4", sub: "#CFE0D6", spark: "#7FD3AE", foot: "#CFE0D6" },
  light: { ground: "#F6F8F4", ink: "#151A13", sub: "#394034", spark: "#34A07C", foot: "#525A4E", logo: "#1E5C45" },
};

// A catalog title as plain text: <br></br> becomes a line break, other tags drop, and the last full stop or
// question mark is set apart so it can take the accent colour, as on the site.
function headline(raw: string): { text: string; mark: string } {
  const text = raw.replace(/<br><\/br>|<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").trim();
  const m = text.match(/^([\s\S]*?)([.?。？]?)$/);
  return { text: m?.[1] ?? text, mark: m?.[2] ?? "" };
}

// Japanese, Korean or Chinese (a List's name, or a page in those languages): the brand fonts have no such glyphs,
// so fetch Noto for exactly the characters used. Fails quietly to the brand fonts.
async function cjk(text: string) {
  const fam = /[぀-ヿ]/.test(text) ? "Noto+Sans+JP" : /[가-힯]/.test(text) ? "Noto+Sans+KR" : /[一-鿿]/.test(text) ? "Noto+Sans+SC" : null;
  if (!fam) return [];
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${fam}:wght@400;700&text=${encodeURIComponent(text)}`)).text();
    const faces = [...css.matchAll(/font-weight: (400|700);[\s\S]*?src: url\((.+?)\) format\('(?:opentype|truetype)'\)/g)];
    return await Promise.all(
      faces.map(async ([, weight, url]) => ({ name: weight === "700" ? "Noto Bold" : "Noto", data: await (await fetch(url!)).arrayBuffer(), weight: Number(weight) as 400 | 700, style: "normal" as const })),
    );
  } catch {
    return [];
  }
}

// The foot defaults to this copy's own address, so a self-hosted copy's previews name it and not getpluck.io.
export async function og({ title, sub, foot = HOST, tone = "forest" }: { title: string; sub?: string; foot?: string; tone?: "forest" | "light" }) {
  const c = C[tone];
  const h = headline(title);
  const lines = h.text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const size = longest > 48 ? 64 : longest > 28 ? 76 : lines.length > 2 ? 84 : 92;
  // Literal URLs: the bundler resolves each to its own asset (a template URL resolved them all to one).
  const [fredoka, geist, geistSemi, extra] = await Promise.all([
    readFile(new URL("./og-fonts/Fredoka-Bold.ttf", import.meta.url)),
    readFile(new URL("./og-fonts/Geist-Regular.ttf", import.meta.url)),
    readFile(new URL("./og-fonts/Geist-SemiBold.ttf", import.meta.url)),
    cjk(`${title}${sub ?? ""}${foot}`),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: c.ground, color: c.ink, fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "flex-start", fontFamily: "Fredoka", fontSize: 46, lineHeight: 0.92, color: "logo" in c ? c.logo : c.ink }}>
          <span>pluck</span>
          <svg width="22" height="22" viewBox="0 0 12 12" style={{ marginLeft: -4, marginTop: 1 }}>
            <path d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85" fill="none" stroke={c.spark} strokeWidth={2} strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fredoka, Noto Bold", fontSize: size, lineHeight: 1.02, letterSpacing: -2.5 }}>
            {lines.map((line, i) => {
              // Word by word, so a long line wraps and its last word keeps the accent mark beside it. Japanese
              // and Chinese have no spaces and wrap anywhere, so they go character by character.
              const spaced = !/[぀-ヿ一-鿿]/.test(line);
              const words = spaced ? line.split(" ") : [...line];
              return (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", columnGap: spaced ? size * 0.26 : 0 }}>
                  {words.map((w, j) =>
                    i === lines.length - 1 && j === words.length - 1 && h.mark ? (
                      <div key={j} style={{ display: "flex" }}><span>{w}</span><span style={{ color: c.spark }}>{h.mark}</span></div>
                    ) : (
                      <span key={j}>{w}</span>
                    ),
                  )}
                </div>
              );
            })}
          </div>
          {sub && <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 400, wordBreak: /[가-힯]/.test(sub) ? "keep-all" : "normal", fontSize: 32, lineHeight: 1.3, color: c.sub, maxWidth: 940 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", fontFamily: "Geist", fontSize: 26, fontWeight: 600, color: c.foot }}>{foot}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Fredoka", data: fredoka, weight: 700, style: "normal" },
        { name: "Geist", data: geist, weight: 400, style: "normal" },
        { name: "Geist", data: geistSemi, weight: 600, style: "normal" },
        ...extra, // Noto for CJK glyphs the brand fonts lack, named by weight so the headline's stack picks the bold
      ],
    },
  );
}
