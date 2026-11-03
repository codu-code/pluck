// Puts real iPad captures into the App Store iPad frames (docs/store/ipad), in place of the drawn screens.
// Usage: node scripts/store-ipad.mjs <captures dir>
//        node scripts/store-ipad.mjs --lang <de|es|fr|…> [captures dir]   the frames with that language's words, from
//        ipad/strings.<lang>.json over art-only, into ipad/<lang>/, with each board's own text layer; with a captures
//        dir, that language's captures (the app in it) go in the screens too.
// The dir holds 2.png … 7.png: 13 in iPad Pro, portrait, 2064 × 2752 (xcrun simctl io booted screenshot), of the
// sample library (node scripts/demo-seed.mjs … --store). A number with no capture keeps its drawn screen (1 is the
// share sheet over Safari, captured by hand). Each frame is written twice, over the designer's own exports:
// with-text (headline and line) and art-only (for other languages' text), PNG with no alpha, as App Store wants.
// Needs the Playwright Chromium (pnpm exec playwright install chromium).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const lang = process.argv[2] === "--lang" ? process.argv[3] : null;
const captures = lang ? null : process.argv[2];
const langShots = lang ? process.argv[4] : null;
if (!captures && !lang) throw new Error("Usage: node scripts/store-ipad.mjs <captures dir> | --lang <code>");

// The device screen in every AppStore-iPad-N board: inside the frame at 103,640 with 26 padding, 1806 × 2408, radius 40.
const SCREEN = { left: 129, top: 666, width: 1806, height: 2408, radius: 40 };
const screen = (path) => `<div style="position:absolute;left:${SCREEN.left}px;top:${SCREEN.top}px;width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;overflow:hidden"><img src="${dataUrl(path)}" style="display:block;width:100%"></div>`;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2064, height: 2752 } });
let done = 0;
if (lang) {
  const { ipadScreenshots, chips } = JSON.parse(readFileSync(join(root, `docs/store/ipad/strings.${lang}.json`), "utf8"));
  const out = join(root, "docs/store/ipad", lang);
  mkdirSync(out, { recursive: true });
  for (const [i, words] of ipadScreenshots.entries()) {
    const n = i + 1;
    const board = readFileSync(join(root, `docs/handover/design/AppStore-iPad-${n}.dc.html`), "utf8");
    const fonts = board.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
    // The text layer as the board draws it, with the words swapped: the headline's last mark in the accent colour.
    const layer = board.match(/<div data-layer="text"[\s\S]*?<\/p>(?:<div style="display: flex; gap: 16px[\s\S]*?<\/div>)?\s*<\/div>/)[0];
    const accent = layer.match(/<span style="color: (#[0-9A-F]{6})">/i)[1];
    const title = words.title.replace(/[.。！!？?]$/u, "");
    const mark = words.title.slice(title.length);
    let html = layer
      .replace(/(<h1[^>]*>)[\s\S]*?<\/h1>/, `$1${esc(title)}<span style="color: ${accent}">${esc(mark)}</span></h1>`)
      .replace(/(<p[^>]*>)[\s\S]*?<\/p>/, `$1${esc(words.subtitle)}</p>`);
    let c = 0;
    html = html.replace(/(<span style="height: 66px[^>]*>)[^<]*(<\/span>)/g, (_, a, b) => `${a}${esc(chips[c++] ?? "")}${b}`);
    const shot = langShots && existsSync(join(langShots, `${n}.png`)) ? screen(join(langShots, `${n}.png`)) : "";
    await page.setContent(`<html><head>${fonts}</head><body style="margin:0;width:2064px;height:2752px;overflow:hidden;position:relative;font-family:'Geist',sans-serif;background:url('${dataUrl(join(root, "docs/store/ipad/art-only", `${n}.png`))}')">${shot}${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(join(out, `${n}.png`), await page.screenshot({ type: "png" }));
    done++;
  }
}
for (let n = 1; n <= 7 && captures; n++) {
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
console.log(lang ? `${done} frames written in ${lang}.` : `${done} frames written, with and without text.`);
