// Puts real iPad captures into the App Store iPad frames (docs/store/ipad), in place of the drawn screens.
// Usage: node scripts/store-ipad.mjs <captures dir>
// The dir holds 2.png … 7.png: 13 in iPad Pro, portrait, 2064 × 2752 (xcrun simctl io booted screenshot), of the
// sample library (node scripts/demo-seed.mjs … --store). A number with no capture keeps its drawn screen (1 is the
// share sheet over Safari, captured by hand). Each frame is written twice, over the designer's own exports:
// with-text (headline and line) and art-only (for other languages' text), PNG with no alpha, as App Store wants.
// Needs the Playwright Chromium (pnpm exec playwright install chromium).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const captures = process.argv[2];
if (!captures) throw new Error("Usage: node scripts/store-ipad.mjs <captures dir>");

// The device screen in every AppStore-iPad-N board: inside the frame at 103,640 with 26 padding, 1806 × 2408, radius 40.
const SCREEN = { left: 129, top: 666, width: 1806, height: 2408, radius: 40 };
const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2064, height: 2752 } });
let done = 0;
for (let n = 1; n <= 7; n++) {
  const shot = join(captures, `${n}.png`);
  if (!existsSync(shot)) continue;
  for (const set of ["with-text", "art-only"]) {
    const frame = join(root, "docs/store/ipad", set, `${n}.png`);
    await page.setContent(`<html><body style="margin:0;width:2064px;height:2752px;overflow:hidden;background:url('${dataUrl(frame)}')">
      <div style="position:absolute;left:${SCREEN.left}px;top:${SCREEN.top}px;width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;overflow:hidden">
        <img src="${dataUrl(shot)}" style="display:block;width:100%">
      </div></body></html>`);
    // An opaque page, so the PNG has no alpha channel (App Store Connect refuses one).
    writeFileSync(frame, await page.screenshot({ type: "png" }));
  }
  done++;
}
await browser.close();
console.log(`${done} frames written, with and without text.`);
