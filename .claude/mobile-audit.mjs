// Responsive audit for the parent app: signs in, visits each route at phone and
// tablet widths, reports page-level horizontal overflow and screenshots each
// route and viewport. Read-only: it navigates and screenshots, and never sends.
//
//   BASE_URL  the app's origin with the school's subdomain
//             (default http://lagoon-view.localhost:5176)
//   ROUTES    space or comma separated app paths (default: every screen)
//   EMAIL / PASSWORD  a seeded parent (default patricia.okafor@example.ng)
//   SHOTS     where screenshots go (default /tmp/parent-fe-audit)
//
// Uses the system Chrome (channel "chrome"), so no browser download is needed.
// Run it from the repository root: node .claude/mobile-audit.mjs

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "http://lagoon-view.localhost:5176").replace(/\/$/, "");
const EMAIL = process.env.EMAIL || "patricia.okafor@example.ng";
const PASSWORD = process.env.PASSWORD || "Parent@School2026";
const SHOTS = process.env.SHOTS || "/tmp/parent-fe-audit";

const DEFAULT_ROUTES = [
  "/", "/results", "/attendance", "/timetable", "/fees", "/notices", "/messages", "/messages/new", "/profile",
];
const routes = (process.env.ROUTES || DEFAULT_ROUTES.join(" "))
  .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
];

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const slug = (p) => p.replace(/^\//, "").replace(/\//g, "-") || "home";

const report = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

// One sign-in serves both widths: the login route throttles repeated attempts.
const ctx = await browser.newContext({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${BASE}/parent/sign-in`, { waitUntil: "load" });
  await page.locator("#signin-email").fill(EMAIL);
  await page.locator("#signin-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("/sign-in"), { timeout: 20000, waitUntil: "commit" });
  console.log("signed in");
} catch (e) {
  console.log(`SIGN-IN FAILED: ${e.message}`);
  await browser.close();
  process.exit(1);
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const path of routes) {
    try {
      await page.goto(`${BASE}/parent${path === "/" ? "/" : path}`, { waitUntil: "load", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const probe = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const docOverflow = Math.max(
          document.documentElement.scrollWidth - vw,
          document.body ? document.body.scrollWidth - vw : 0,
        );
        const offenders = [];
        if (docOverflow > 1) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width < 2) continue;
            if (getComputedStyle(el).position === "fixed") continue;
            if (r.right > vw + 2 || r.left < -2) {
              let a = el.parentElement, clipped = false;
              while (a && a !== document.body) {
                if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) { clipped = true; break; }
                a = a.parentElement;
              }
              if (!clipped) {
                offenders.push({
                  tag: el.tagName.toLowerCase(),
                  cls: (typeof el.className === "string" ? el.className : "").slice(0, 120),
                  left: Math.round(r.left), right: Math.round(r.right),
                });
              }
            }
          }
        }
        return { vw, docOverflow: Math.round(docOverflow), offenders: offenders.slice(0, 10) };
      });
      const file = `${SHOTS}/${slug(path)}@${vp.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      report.push({ path, vp: vp.name, overflow: probe.docOverflow, offenders: probe.offenders, file });
      console.log(`[${vp.name}] ${path}${probe.docOverflow > 1 ? ` OVERFLOW +${probe.docOverflow}px` : " ok"}`);
    } catch (e) {
      console.log(`[${vp.name}] ${path} DRIVE-ERROR: ${e.message.slice(0, 120)}`);
      report.push({ path, vp: vp.name, driveError: e.message.slice(0, 200) });
    }
  }
}
if (errors.length) console.log("page errors:\n" + errors.slice(0, 10).map((e) => "  " + e.slice(0, 200)).join("\n"));
await ctx.close();

fs.writeFileSync(`${SHOTS}/report.json`, JSON.stringify(report, null, 2));
for (const r of report.filter((r) => (r.overflow ?? 0) > 1)) {
  console.log(`\n${r.vp} ${r.path} +${r.overflow}px`);
  for (const o of r.offenders ?? []) console.log(`   <${o.tag}> left:${o.left} right:${o.right} ${o.cls}`);
}
console.log(`\nshots and report.json in ${SHOTS}/`);
await browser.close();
