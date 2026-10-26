/**
 * Renders the XVS crest into the source art for the store apps' icon and splash.
 *
 * Writes `assets/`, which `npx capacitor-assets generate` turns into every
 * icon and splash size in `ios/` and `android/` (`npm run store-art` runs both).
 *
 * - `icon-only.png`: the iOS icon, 1024 square with no transparency, the crest
 *   on the app's light background.
 * - `icon-foreground.png` and `icon-background.png`: Android's adaptive icon.
 *   The crest stays inside the middle of the foreground, the safe zone a phone
 *   may crop its own shape from.
 * - `splash.png` and `splash-dark.png`: the crest centred on the light and the
 *   dark background, 2732 square.
 *
 * Only the XVS crest appears, never the bare CodeX mark. Drives the installed
 * Google Chrome through Playwright, as `render-icons.mjs` does.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const crest = readFileSync(join(root, "public/svg/xvs-logo.svg"), "utf8");
const crestWhite = readFileSync(join(root, "public/svg/xvs-logo-white.svg"), "utf8");

/** The app's page background (`index.html`'s boot screen) and its dark theme background. */
const LIGHT = "#F9FAFB";
const DARK = "#0A0A0A";

const ART = [
  { file: "icon-only.png", size: 1024, fill: 0.62, svg: crest, background: LIGHT },
  { file: "icon-foreground.png", size: 1024, fill: 0.46, svg: crest, background: "transparent" },
  { file: "icon-background.png", size: 1024, fill: 0, svg: "", background: LIGHT },
  { file: "splash.png", size: 2732, fill: 0.2, svg: crest, background: LIGHT },
  { file: "splash-dark.png", size: 2732, fill: 0.2, svg: crestWhite, background: DARK },
];

mkdirSync(join(root, "assets"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
for (const { file, size, fill, svg, background } of ART) {
  await page.setViewportSize({ width: size, height: size });
  const mark = svg ? svg.replace("<svg ", '<svg style="height:100%;width:auto" ') : "";
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;
    display:flex;align-items:center;justify-content:center;background:${background}">
    <div style="height:${Math.round(size * fill)}px;display:flex;justify-content:center">${mark}</div>
    </body></html>`);
  await page.screenshot({ path: join(root, "assets", file), omitBackground: background === "transparent" });
  console.log(`assets/${file}`);
}
await browser.close();
