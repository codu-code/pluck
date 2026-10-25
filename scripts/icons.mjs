// Every app icon and favicon, drawn from packages/ui/src/icon.json (the same geometry as the Icon component).
// Usage: node scripts/icons.mjs   (needs the Playwright Chromium for the PNGs: pnpm exec playwright install chromium)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icon = JSON.parse(readFileSync(join(root, "packages/ui/src/icon.json"), "utf8"));
const n = (x) => Number(x.toFixed(3));

/**
 * One icon as an SVG string.
 * shape: "rounded" (the tile with its corners), "square" (iOS and the web's touch icons round it themselves),
 * "maskable" (square, the glyph inside the 80% safe circle). Bare tones draw the glyph alone.
 */
export function iconSvg({ size, tone = "forest", shape = "rounded" }) {
  const t = icon.tones[tone];
  const s = icon.glyphScale;
  let glyph = t.tile ? Math.round(size * (size <= s.tinyTileAt ? s.tinyTile : s.tile)) : size;
  if (shape === "maskable") glyph = Math.round(size * 0.5);
  if (!t.tile) glyph = Math.round(size * 0.92); // a file has no overflow: keep the top spark inside the edge
  const g = glyph <= icon.smallAt ? icon.glyph.small : icon.glyph.large;
  const off = n((size - glyph) / 2);
  const tile = t.tile
    ? `<rect width="${size}" height="${size}"${shape === "rounded" ? ` rx="${n(size * icon.radius)}"` : ""} fill="${t.bg}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${tile}` +
    `<g transform="translate(${off} ${off}) scale(${n(glyph / 20)})">` +
    `<path d="${g.stem}" fill="none" stroke="${t.ink}" stroke-width="${g.stemWidth}" stroke-linecap="round"/>` +
    `<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}" fill="none" stroke="${t.ink}" stroke-width="${g.ringWidth}"/>` +
    `<path d="${g.sparks}" fill="none" stroke="${t.spark}" stroke-width="${g.sparkWidth}" stroke-linecap="round"/>` +
    `</g></svg>\n`
  );
}

const ios = JSON.parse(readFileSync(join(root, "apps/ios/targets/share/Assets.xcassets/AppIcon.appiconset/Contents.json"), "utf8"));
const iosShare = ios.images
  .filter((i) => i.filename)
  .map((i) => ({ path: `apps/ios/targets/share/Assets.xcassets/AppIcon.appiconset/${i.filename}`, size: Math.round(parseFloat(i.size) * parseInt(i.scale)), shape: "square" }));

const SVGS = [
  { path: "apps/web/public/icon.svg", size: 1024 },
  { path: "apps/web/public/favicon-32.svg", size: 32 },
  { path: "apps/web/public/favicon-16.svg", size: 16 },
  { path: "docs/handover/brand/icon-1024.svg", size: 1024 },
  { path: "docs/handover/brand/icon-mint-1024.svg", size: 1024, tone: "mint" },
  { path: "docs/handover/brand/icon-dark-1024.svg", size: 1024, tone: "dark" },
  { path: "docs/handover/brand/favicon-32.svg", size: 32 },
  { path: "docs/handover/brand/favicon-16.svg", size: 16 },
  { path: "docs/handover/brand/glyph-bare.svg", size: 64, tone: "bare" },
];

const PNGS = [
  // Web: the touch icon and the manifest's icons go out square; the platforms round them.
  { path: "apps/web/public/icon-180.png", size: 180, shape: "square" },
  { path: "apps/web/public/icon-192.png", size: 192, shape: "square" },
  { path: "apps/web/public/icon-512.png", size: 512, shape: "square" },
  { path: "apps/web/public/icon-maskable-512.png", size: 512, shape: "maskable" },
  // Extension: the filled tile once a page is plucked, the bare glyph before. 128 is the store icon.
  ...[16, 32, 48, 128].map((size) => ({ path: `apps/extension/public/icon/${size}.png`, size })),
  ...[16, 32].map((size) => ({ path: `apps/extension/public/icon/empty-${size}.png`, size, tone: "bare" })),
  // iOS: the app icon and its Dark alternate (square; iOS masks them), and the share extension's set.
  { path: "apps/ios/assets/icon.png", size: 1024, shape: "square" },
  { path: "apps/ios/assets/icon-dark.png", size: 1024, tone: "dark", shape: "square" },
  ...iosShare,
];

for (const f of SVGS) {
  mkdirSync(dirname(join(root, f.path)), { recursive: true });
  writeFileSync(join(root, f.path), iconSvg(f));
}

const { chromium } = await import("@playwright/test").catch(() => import("playwright"));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of PNGS) {
  await page.setViewportSize({ width: f.size, height: f.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${iconSvg(f)}`);
  await page.screenshot({ path: join(root, f.path), omitBackground: true });
}
// The iPhone launch screen: the wordmark (packages/ui's Logo) on each ground, 3x of the 150 pt it shows at.
const fredoka = readFileSync(join(root, "apps/ios/node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf")).toString("base64");
const SPLASH = [
  { path: "apps/ios/assets/splash.png", ink: "#1E5C45", spark: "#34A07C" },
  { path: "apps/ios/assets/splash-dark.png", ink: "#ECEFE8", spark: "#7FD3AE" },
];
for (const f of SPLASH) {
  await page.setViewportSize({ width: 600, height: 300 });
  await page.setContent(
    `<style>@font-face{font-family:F;src:url(data:font/ttf;base64,${fredoka})}html,body{margin:0;background:transparent}` +
      `#w{display:inline-flex;align-items:flex-start;font:700 132px/0.92 F;letter-spacing:-0.01em;color:${f.ink};padding:8px 4px 16px}` +
      `svg{width:.457em;height:.457em;overflow:visible;margin-left:-.098em;margin-top:.022em}</style>` +
      `<span id="w">pluck<svg viewBox="0 0 12 12"><path d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85" fill="none" stroke="${f.spark}" stroke-width="1.8" stroke-linecap="round"/></svg></span>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#w").screenshot({ path: join(root, f.path), omitBackground: true });
}
await browser.close();
console.log(`${SVGS.length} SVGs and ${PNGS.length + SPLASH.length} PNGs written.`);
