/**
 * Facts about the browser the parent is in, for push support decisions.
 *
 * `install-first` is iPhone Safari outside the installed app: iOS only
 * delivers notifications to a PWA added to the Home Screen. The install card
 * ships in Phase 7; until then the Profile setting tells the parent what to do.
 */
export type BrowserFacts = { apple: boolean; safari: boolean };

export function browserFacts(ua: string = navigator.userAgent): BrowserFacts {
  const apple = /iPad|iPhone|iPod/.test(ua);
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return { apple, safari };
}

export function isAppleMobile(facts: BrowserFacts): boolean {
  return facts.apple;
}

/**
 * True when the current window is running as a Home-Screen / installed PWA
 * (`display: standalone`), not inside a regular Safari tab. iOS only shows
 * notifications when this is true.
 */
export function runningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari's non-standard flag, kept because the standard match returns
  // false on an older WebKit.
  const iosFlag = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosFlag;
}
