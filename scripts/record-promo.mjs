// Records the 20-second promo (docs/store/promo/promo.html) to docs/store/promo/pluck-promo-1080.mp4.
// Usage: node scripts/record-promo.mjs   (needs the Playwright Chromium and ffmpeg; Google Fonts must be reachable,
// or Fredoka, Geist, Geist Mono and Source Serif 4 installed locally)
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = pathToFileURL(join(root, "docs/store/promo/promo.html")).href;
const out = join(root, "test-results/promo");
const FPS = 30, LENGTH = 20_000;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
await tab.goto(`${page}?t=0`);
await tab.evaluate(() => document.fonts.ready);
// Every animation reads --at as its delay, paused: one frame per step, no timing drift.
for (let i = 0; i < (LENGTH / 1000) * FPS; i++) {
  await tab.evaluate((t) => {
    const fit = document.getElementById("fit");
    fit.style.setProperty("--at", `-${t / 1000}s`);
    fit.style.setProperty("--play", "paused");
  }, (i * 1000) / FPS);
  await tab.screenshot({ path: join(out, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();

execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", join(out, "f%04d.png"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(root, "docs/store/promo/pluck-promo-1080.mp4")], { stdio: "inherit" });
console.log("docs/store/promo/pluck-promo-1080.mp4 written.");
