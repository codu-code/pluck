// The App Store iPhone set in another language: boards AppStore1 to 5 (docs/handover/design) drawn with that
// language's words (docs/store/screenshots/strings.<lang>.json) and, where there is one, a real capture of the app in
// that language in the phone, in place of the drawn screen. Frame 1's drawn share sheet takes that language's words
// from docs/store/frame1.json.
// Usage: node scripts/store-iphone.mjs <lang> [captures dir with 2.png … 5.png, iPhone, 1206 × 2622 or 1320 × 2868]
// Writes docs/store/screenshots/<lang>/1.png … 5.png at 1320 × 2868, PNG with no alpha.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paintBars, TEXT_CSS, words } from "./store-words.mjs";

const root = join(import.meta.dirname, "..");
const [lang, captures] = process.argv.slice(2);
if (!lang) throw new Error("Usage: node scripts/store-iphone.mjs <lang> [captures dir]");
const { iphoneScreenshots } = JSON.parse(readFileSync(join(root, `docs/store/screenshots/strings.${lang}.json`), "utf8"));
const words1 = words(lang);
const out = join(root, "docs/store/screenshots", lang);
mkdirSync(out, { recursive: true });

const { chromium } = await import("@playwright/test");
// The boards' status bar and Dynamic Island (AppStore1), which go over a capture's own.
const BAR = `<div style="position: absolute; left: 0; top: 0; width: 390px; transform: scale(2.7692); transform-origin: 0 0; font-family: 'Geist', ui-sans-serif, sans-serif"><div data-bar="0.5" style="height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 6px 32px 0 40px; font-weight: 600; font-size: 16px"><span>9:41</span><span style="display: flex; gap: 6px; align-items: center"><svg width="18" height="12" viewBox="0 0 18 12"><path d="M1 11h2V8H1zM5 11h2V6H5zM9 11h2V3H9zM13 11h2V1h-2z" fill="currentColor"/></svg><svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/></svg></span></div></div><div style="position: absolute; left: 50%; top: 32px; width: 300px; height: 88px; margin-left: -150px; border-radius: 44px; background: #0B0D0A"></div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
for (const [i, words] of iphoneScreenshots.entries()) {
  const n = i + 1;
  await page.setContent(readFileSync(join(root, `docs/handover/design/AppStore${n}.dc.html`), "utf8"), { waitUntil: "networkidle" });
  const shot = captures && existsSync(join(captures, `${n}.png`)) ? `data:image/png;base64,${readFileSync(join(captures, `${n}.png`)).toString("base64")}` : null;
  await page.addStyleTag({ content: TEXT_CSS });
  const over = await page.evaluate(({ title, subtitle, shot, lang, map, bar }) => {
    document.documentElement.lang = lang; // the CJK fonts follow the language, as on the site
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t; (t = walk.nextNode()); ) {
      const k = t.nodeValue.trim();
      if (map[k]) t.nodeValue = t.nodeValue.replace(k, map[k]);
    }
    // The headline keeps the board's accent full stop (or 。); the line under it is the 48 px paragraph.
    const h1 = document.querySelector("h1");
    const accent = h1.querySelector("span")?.style.color ?? "#34A07C";
    const body = title.replace(/[.。！!？?]$/u, "");
    h1.textContent = body;
    const mark = document.createElement("span");
    mark.style.color = accent;
    mark.textContent = title.slice(body.length);
    h1.append(mark);
    const p = [...document.querySelectorAll("p")].find((x) => x.style.fontSize === "48px");
    if (p) p.textContent = subtitle;
    if (shot) {
      const screen = [...document.querySelectorAll("div")].find((d) => d.style.width === "1080px" && d.style.height === "2337px");
      screen.dataset.screen = "";
      screen.innerHTML = `<img src="${shot}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:top">${bar}`;
    }
    const phone = [...document.querySelectorAll("div")].find((d) => d.style.width === "1128px");
    return h1.parentElement.getBoundingClientRect().bottom - phone.getBoundingClientRect().top;
  }, { title: words.title, subtitle: words.subtitle, shot, lang, map: words1, bar: BAR });
  await page.evaluate(() => document.fonts.ready);
  if (over > -24) throw new Error(`${lang} frame ${n}: the words end ${Math.round(-over)} px from the phone, and need 24. Shorten them in screenshots/strings.${lang}.json.`);
  await page.evaluate(paintBars);
  writeFileSync(join(out, `${n}.png`), await page.screenshot({ type: "png" }));
}
await browser.close();
console.log(`${iphoneScreenshots.length} iPhone frames written in ${lang}.`);
