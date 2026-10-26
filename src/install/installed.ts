/**
 * Whether the app is installed on this device, so the install offer never
 * shows to somebody who already has it.
 *
 * Any one of three things counts:
 *
 * - **The page is the installed app.** It runs in a display mode of its own
 *   (`standalone`, `fullscreen` or `minimal-ui`), or, on an iPhone, Safari
 *   says `navigator.standalone`. The display mode is watched, so the offer
 *   goes the moment the page opens as the app.
 * - **This device installed it earlier.** Recorded here when the browser says
 *   it installed the app (`appinstalled`, or an accepted install prompt), so
 *   a parent who installed it and later opens the plain link in their browser
 *   is not offered it again. Storage that cannot be read reads as not
 *   recorded.
 * - **The browser says so.** Chrome on Android (and on a computer) answers
 *   `navigator.getInstalledRelatedApps()` with the app when it is installed,
 *   because both manifests list themselves under `related_applications`. It
 *   is asked once the school's manifest has been put on the page.
 *
 * An iPhone cannot tell a Safari tab that the app is on its Home Screen: there
 * only the installed app itself hides the offer, by its display mode.
 */

import { isNativeApp } from "@/native/platform";

const INSTALLED_KEY = "xvs.parent.installed";
const DISPLAY_MODES = ["standalone", "fullscreen", "minimal-ui"] as const;

type RelatedApp = { platform: string; url?: string; id?: string };
type NavigatorWithInstall = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
};

const listeners = new Set<() => void>();
let relatedInstalled = false;

function notify() {
  for (const listener of listeners) listener();
}

/** True when this page is running as the installed app. */
export function runningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const ownWindow = DISPLAY_MODES.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches === true);
  return ownWindow || (navigator as NavigatorWithInstall).standalone === true;
}

function rememberedInstall(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Records that this device installed the app, and tells everything watching. */
export function rememberInstall(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Not kept: the display-mode check still hides the offer inside the app.
  }
  notify();
}

/**
 * Whether the app is installed on this device, by any of the three checks.
 * The store app is installed by definition, so it is never offered an install.
 */
export function isInstalled(): boolean {
  if (isNativeApp()) return true;
  return runningInstalled() || rememberedInstall() || relatedInstalled;
}

/** Asks the browser whether the app is installed, where it can say. */
export async function checkRelatedApps(): Promise<void> {
  const ask = (navigator as NavigatorWithInstall).getInstalledRelatedApps;
  if (typeof ask !== "function") return;
  try {
    const apps = await ask.call(navigator);
    if (!apps.some((app) => app.platform === "webapp")) return;
    relatedInstalled = true;
    notify();
  } catch {
    // The browser would not say: the other two checks stand.
  }
}

/** Calls `listener` whenever the answer to `isInstalled()` may have changed. */
export function subscribeInstalled(listener: () => void): () => void {
  listeners.add(listener);
  const queries = DISPLAY_MODES.map((mode) => window.matchMedia?.(`(display-mode: ${mode})`)).filter(
    (query): query is MediaQueryList => !!query,
  );
  for (const query of queries) query.addEventListener?.("change", listener);
  return () => {
    listeners.delete(listener);
    for (const query of queries) query.removeEventListener?.("change", listener);
  };
}
