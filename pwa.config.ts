/**
 * What the service worker may keep, and what it must never touch.
 *
 * It caches the app itself (scripts, styles, fonts, the crest) so the app
 * opens with no signal, and nothing a parent can read. Parent data never goes
 * through the service worker's cache: a cache keyed by address would hand one
 * parent's reads back to another on the same browser.
 *
 * So the API (`/v1/`) and uploaded files (`/media/`) are excluded from the
 * navigation fallback and given no runtime caching rule at all, and the
 * fallback page is the app's own `index.html` under `/parent/`, never a page
 * of school-fe's or student-fe's, which share the origin.
 *
 * Push notifications are handled by `public/push-sw.js`, loaded into the
 * generated worker. It shows what the school sent and opens the right
 * `/parent/...` screen on tap; it caches nothing.
 */
export const workboxOptions = {
  globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
  navigateFallback: "/parent/index.html",
  navigateFallbackAllowlist: [/^\/parent\//],
  navigateFallbackDenylist: [/^\/v1\//, /^\/media\//],
  runtimeCaching: [],
  cleanupOutdatedCaches: true,
  importScripts: ["push-sw.js"],
};
