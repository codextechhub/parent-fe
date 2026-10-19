import type { PromptState } from "./install-prompt";

/**
 * Which way of installing this browser offers, for a device that has not
 * installed the app. The card says exactly one thing, by situation:
 *
 * - `prompt`: the browser gave an install prompt (Chrome on Android, Chrome
 *   or Edge on a computer); the card's Install button shows it.
 * - `prompt-dismissed`: that prompt was turned down, and the browser gives no
 *   second one in the same page load; its menu still has Install app.
 * - `ios-safari`: Safari on an iPhone or iPad, which has no install API; the
 *   card shows Share, Add to Home Screen, Add.
 * - `open-in-safari`: an iPhone browser that cannot add to the Home Screen
 *   (Chrome, Firefox, Edge on iOS) or an app's built-in browser on an iPhone.
 * - `open-in-chrome`: an app's built-in browser elsewhere (Instagram,
 *   Facebook, Messenger, Snapchat, TikTok, LinkedIn, Line), or an Android
 *   browser other than Chrome (Samsung Internet, Edge, Opera, the phone
 *   makers' own).
 * - `menu`: anything else (Firefox, Safari on a Mac, a browser not yet
 *   known): the browser's menu, with no button that cannot work.
 *
 * On Android only Chrome's install is offered. Installing makes a small
 * Android app around the page, and the browser builds it: Chrome's is built
 * for a current Android, while Samsung Internet's is built for an old one,
 * so Play Protect warns that installing it "may put your device at risk".
 * Other browsers are sent to Chrome even when they offer a prompt, rather
 * than risk that warning in front of a parent.
 *
 * WhatsApp on Android opens links in Chrome, so it is `prompt` or `menu`. On
 * an iPhone its built-in Safari view carries Safari's own user agent and
 * reads as `ios-safari`; the steps say to open the page in Safari where Add to
 * Home Screen is missing.
 */
export type InstallSituation =
  | "prompt"
  | "prompt-dismissed"
  | "ios-safari"
  | "open-in-safari"
  | "open-in-chrome"
  | "menu";

/** Apps whose built-in browser cannot install a web app, by their user agent's marks. */
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|\bLine\/|Snapchat|TikTok|musical_ly|Bytedance|LinkedInApp/i;
/** Android browsers other than Chrome; most carry "Chrome/" in their user agent too. */
const ANDROID_OTHER_BROWSER =
  /SamsungBrowser|EdgA\/|OPR\/|OPT\/|Opera|YaBrowser|UCBrowser|UCWEB|MiuiBrowser|XiaoMi|HeyTapBrowser|VivoBrowser|PHX\/|Phoenix|HiBrowser/i;
/** iPhone browsers other than Safari. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//;

export type BrowserFacts = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
};

export function browserFacts(): BrowserFacts {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

/** True on an iPhone, iPod or iPad, including an iPad that says it is a Mac. */
export function isAppleMobile({ userAgent, platform, maxTouchPoints }: BrowserFacts): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function isAndroid({ userAgent }: BrowserFacts): boolean {
  return /Android/i.test(userAgent);
}

export function installSituation(facts: BrowserFacts, prompt: PromptState): InstallSituation {
  const inApp = IN_APP_BROWSER.test(facts.userAgent);
  if (isAppleMobile(facts)) {
    return inApp || IOS_OTHER_BROWSER.test(facts.userAgent) ? "open-in-safari" : "ios-safari";
  }
  if (inApp || (isAndroid(facts) && ANDROID_OTHER_BROWSER.test(facts.userAgent))) return "open-in-chrome";
  if (prompt === "ready") return "prompt";
  if (prompt === "dismissed") return "prompt-dismissed";
  return "menu";
}
