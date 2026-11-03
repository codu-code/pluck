// The App Store iPhone set in another language: boards AppStore1 to 5 (docs/handover/design) drawn with that
// language's words (docs/store/screenshots/strings.<lang>.json) and, where there is one, a real capture of the app in
// that language in the phone, in place of the drawn screen. Frame 1 keeps its drawn share sheet.
// Usage: node scripts/store-iphone.mjs <lang> [captures dir with 2.png … 5.png, iPhone, 1206 × 2622 or 1320 × 2868]
// Writes docs/store/screenshots/<lang>/1.png … 5.png at 1320 × 2868, PNG with no alpha.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const [lang, captures] = process.argv.slice(2);
if (!lang) throw new Error("Usage: node scripts/store-iphone.mjs <lang> [captures dir]");
const { iphoneScreenshots } = JSON.parse(readFileSync(join(root, `docs/store/screenshots/strings.${lang}.json`), "utf8"));
const out = join(root, "docs/store/screenshots", lang);
mkdirSync(out, { recursive: true });

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 2868 } });
for (const [i, words] of iphoneScreenshots.entries()) {
  const n = i + 1;
  await page.setContent(readFileSync(join(root, `docs/handover/design/AppStore${n}.dc.html`), "utf8"), { waitUntil: "networkidle" });
  const shot = captures && existsSync(join(captures, `${n}.png`)) ? `data:image/png;base64,${readFileSync(join(captures, `${n}.png`)).toString("base64")}` : null;
  await page.evaluate(({ title, subtitle, shot, lang }) => {
    document.documentElement.lang = lang; // the CJK fonts follow the language, as on the site
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
      screen.innerHTML = `<img src="${shot}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:top">`;
    }
  }, { title: words.title, subtitle: words.subtitle, shot, lang });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(out, `${n}.png`), await page.screenshot({ type: "png" }));
}
await browser.close();
console.log(`${iphoneScreenshots.length} iPhone frames written in ${lang}.`);
