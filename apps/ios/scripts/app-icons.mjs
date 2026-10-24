// Renders the two app icons from packages/ui's Icon (tones "forest" and "dark") as 1024 px PNGs for app.config.ts.
// Usage: node apps/ios/scripts/app-icons.mjs   (needs the Playwright Chromium: pnpm exec playwright install chromium)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import ts from "typescript";

const here = (p) => new URL(p, import.meta.url);
const web = createRequire(here("../../web/package.json")); // react-dom lives with the web app
const source = readFileSync(here("../../../packages/ui/src/Icon.tsx"), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } });
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(web, mod, mod.exports);
const { createElement } = web("react");
const { renderToStaticMarkup } = web("react-dom/server");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [tone, file] of [["forest", "icon.png"], ["dark", "icon-dark.png"]]) {
  // iOS rounds the corners itself, so the tile goes out square.
  const html = renderToStaticMarkup(createElement(mod.exports.Icon, { size: 1024, tone }));
  await page.setContent(`<style>body{margin:0}body>span{border-radius:0!important}</style>${html}`);
  await page.screenshot({ path: new URL(`../assets/${file}`, import.meta.url).pathname });
}
await browser.close();
