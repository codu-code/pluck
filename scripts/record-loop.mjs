// Records the connect loop to MP4 and GIF (README, socials, an App Store preview).
// Usage: node scripts/record-loop.mjs   (needs the Playwright Chromium and ffmpeg; Google Fonts must be reachable)
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = pathToFileURL(join(root, "docs/handover/motion/connect-loop.html")).href;
const out = join(root, "test-results/loop");
const FPS = 30, LOOP = 10_000;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1232, height: 782 }, deviceScaleFactor: 2 });
for (let i = 0; i < (LOOP / 1000) * FPS; i++) {
  await tab.goto(`${page}?t=${Math.round((i * 1000) / FPS)}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.locator(".loop").screenshot({ path: join(out, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();

const frames = join(out, "f%04d.png");
execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", frames, "-vf", "scale=1200:750", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", join(root, "connect-loop.mp4")], { stdio: "inherit" });
execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", frames, "-vf", "fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", join(root, "connect-loop.gif")], { stdio: "inherit" });
console.log("connect-loop.mp4 and connect-loop.gif written.");
