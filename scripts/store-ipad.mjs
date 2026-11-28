// The App Store iPad set in one language: boards AppStore-iPad-1 to 7 (docs/handover/design) with that language's
// words from ipad/strings.<lang>.json and, in frames 2 to 5, a real capture of the app in that language.
// Usage: node scripts/store-ipad.mjs --lang <en|de|es|fr|…> [captures dir]
// The dir holds 2.png … 5.png: 13 in iPad Pro, portrait, 2064 × 2752 (scripts/store-capture.sh), of the sample
// library (node scripts/demo-seed.mjs … --store). Without one, frames 2 to 5 are left as they are. Frames 1, 6 and 7
// draw their screens. Writes ipad/<lang>/1.png … 7.png (English: ipad/with-text), 2064 × 2752, PNG with no alpha, as
// App Store wants. ipad/art-only is the designer's frames with no words, which frames 2 to 5 are laid over.
// Needs the Playwright Chromium (pnpm exec playwright install chromium).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paintBars, TEXT_CSS, words } from "./store-words.mjs";

const root = join(import.meta.dirname, "..");
const lang = process.argv[2] === "--lang" ? process.argv[3] : null;
const langShots = process.argv[4];
if (!lang) throw new Error("Usage: node scripts/store-ipad.mjs --lang <code> [captures dir]");

// The device screen in every AppStore-iPad-N board: inside the frame at 103,640 with 26 padding, 1806 × 2408, radius 40.
const SCREEN = { left: 129, top: 666, width: 1806, height: 2408, radius: 40 };
// The boards' status bar (AppStore-iPad-1), which goes over a capture's own: one part over the sidebar, one over the page.
const bar = (date) => `<div style="position:absolute;left:0;top:0;width:1032px;height:24px;transform:scale(1.75);transform-origin:0 0;display:flex;font-size:13px;font-weight:600"><div data-bar="0.3" style="width:360px;box-sizing:border-box;padding-left:20px;display:flex;align-items:center"><span>9:41 <span style="font-weight:400">${esc(date)}</span></span></div><div data-bar="0.6" style="flex:1;padding-right:20px;display:flex;gap:6px;align-items:center;justify-content:flex-end"><svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 10.5l2.2-2.6a3.2 3.2 0 0 0-4.4 0zM3.4 5.6a6.5 6.5 0 0 1 9.2 0M1 3.2a9.8 9.8 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>100%<svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor"/></svg></div></div>`;
const screen = (path, date) => `<div data-screen style="position:absolute;left:${SCREEN.left}px;top:${SCREEN.top}px;width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;overflow:hidden"><img src="${dataUrl(path)}" style="display:block;width:100%">${bar(date)}</div>`;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2064, height: 2752 } });
let done = 0;
// The words must stop 24 px short of the iPad, whose frame begins at 640.
const fits = async (n) => {
  const bottom = await page.evaluate(() => document.querySelector('[data-layer="text"]').lastElementChild.getBoundingClientRect().bottom);
  if (bottom > 616) throw new Error(`${lang} frame ${n}: the words end ${Math.round(640 - bottom)} px from the iPad, and need 24. Shorten them in ipad/strings.${lang}.json.`);
};
{
  const { ipadScreenshots, chips } = JSON.parse(readFileSync(join(root, `docs/store/ipad/strings.${lang}.json`), "utf8"));
  const words1 = words(lang);
  const out = join(root, "docs/store/ipad", lang === "en" ? "with-text" : lang);
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
    if (chips) html = html.replace(/(<span style="height: 66px[^>]*>)[^<]*(<\/span>)/g, (_, a, b) => `${a}${esc(chips[c++] ?? "")}${b}`); // English keeps the board's
    const shot = langShots && existsSync(join(langShots, `${n}.png`)) ? screen(join(langShots, `${n}.png`), words1["Thu 14 Jan"] ?? "Thu 14 Jan") : "";
    if (!shot && n >= 2 && n <= 5 && existsSync(join(out, `${n}.png`))) continue; // keep the captured frames as they are
    if ((n === 1 || n >= 6) && !shot) {
      // Frames 1, 6 and 7 draw their screens, so the whole board is drawn again in this language (store-words.mjs),
      // not laid over the English art. Frame 7's split view under the keys is this language's frame 2 capture.
      await page.setContent(board.replace(/<div data-layer="text"[\s\S]*?<\/p>(?:<div style="display: flex; gap: 16px[\s\S]*?<\/div>)?\s*<\/div>/, html), { waitUntil: "networkidle" });
      await page.evaluate(({ map, lang }) => {
        document.documentElement.lang = lang;
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let t; (t = walk.nextNode()); ) {
          const k = t.nodeValue.trim();
          if (map[k]) t.nodeValue = t.nodeValue.replace(k, map[k]);
        }
      }, { map: words1, lang });
      await page.addStyleTag({ content: TEXT_CSS });
      // A long shortcut name wraps onto two lines inside its row, rather than pushing its keys out of the panel.
      if (n === 7) await page.addStyleTag({ content: '[data-layer="art"] span[style*="white-space: nowrap"] { white-space: normal !important; line-height: 17px }' });
      const two = join(out, "2.png");
      if (n === 7 && existsSync(two)) {
        await page.evaluate(async ({ src, s }) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = Object.assign(document.createElement("canvas"), { width: s.width, height: s.height });
          c.getContext("2d").drawImage(img, s.left, s.top, s.width, s.height, 0, 0, s.width, s.height);
          document.querySelector('[data-layer="art"] img').src = c.toDataURL("image/png");
        }, { src: dataUrl(two), s: SCREEN });
        await page.evaluate(() => document.querySelector('[data-layer="art"] img').decode());
      }
      await page.evaluate(() => document.fonts.ready);
      await fits(n);
      writeFileSync(join(out, `${n}.png`), await page.screenshot({ type: "png" }));
      done++;
      continue;
    }
    await page.setContent(`<html lang="${lang}"><head>${fonts}<style>${TEXT_CSS}</style></head><body style="margin:0;width:2064px;height:2752px;overflow:hidden;position:relative;font-family:'Geist',sans-serif;background:url('${dataUrl(join(root, "docs/store/ipad/art-only", `${n}.png`))}')">${shot}${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(paintBars);
    await fits(n);
    writeFileSync(join(out, `${n}.png`), await page.screenshot({ type: "png" }));
    done++;
  }
}
await browser.close();
console.log(`${done} frames written in ${lang}.`);
