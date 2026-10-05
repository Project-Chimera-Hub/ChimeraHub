/*
 * Renders the APK's icon and splash from shell/favicon.svg, so the app on a
 * phone carries the same mark as the browser tab.
 *
 *   node tools/apk/make-assets.mjs     → tools/apk/assets/{icon,splash}.png
 *
 * Run it after changing the favicon, and commit the two PNGs: the APK build
 * (tools/build-apk.sh) hands them to capacitor-assets, which cuts every size
 * Android wants from them. Needs Playwright's Chromium, as the tests do.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/* As tools/check-trainer.mjs loads it: a local install, else a global one. */
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = createRequire(import.meta.url)("playwright")); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const svg = fs.readFileSync(path.join(ROOT, "shell/favicon.svg"), "utf8");
const out = path.join(ROOT, "tools/apk/assets");
const ground = svg.match(/<rect width="64" height="64" fill="(#[0-9a-f]{6})"/i)[1];

/* The icon fills its square; the splash is the mark small and centred on the
   same ground, at the size the old splash had it (a quarter of the width). */
const shots = [
  { file: "icon.png", size: 1024, mark: 1024 },
  { file: "splash.png", size: 2732, mark: 658 },
];

const browser = await chromium.launch(
  fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
for (const { file, size, mark } of shots) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>
    html, body { margin: 0; height: 100%; background: ${ground}; }
    body { display: grid; place-items: center; }
    svg { display: block; width: ${mark}px; height: ${mark}px; }
  </style>${svg}`);
  await page.screenshot({ path: path.join(out, file) });
  console.log(`${file}: ${size}×${size}`);
}
await browser.close();
