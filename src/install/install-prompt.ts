import { rememberInstall } from "./installed";

/**
 * The browser's own install prompt, kept for the moment a parent taps Install.
 *
 * Chrome, Edge and Samsung Internet fire `beforeinstallprompt` when the app
 * can be installed, often before React has mounted, so `captureInstallPrompt`
 * runs from `main.tsx` first thing. It stops the browser's own banner and
 * keeps the event; the install card shows Install while one is kept.
 *
 * A prompt can be shown once. Accepted, it records the install; dismissed, the
 * browser gives no second prompt in the same page load, so the state turns to
 * `dismissed` and the card points at the browser's menu instead.
 * `appinstalled` (from the prompt, or from the browser's own menu) records the
 * install and tells `onInstalled` listeners, once per page load.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

/** `ready`: a prompt is kept. `dismissed`: it was shown and turned down. `none`: no prompt. */
export type PromptState = "none" | "ready" | "dismissed";

let saved: BeforeInstallPromptEvent | null = null;
let state: PromptState = "none";
let announced = false;
const listeners = new Set<() => void>();
const installedListeners = new Set<() => void>();

function set(next: PromptState) {
  state = next;
  for (const listener of listeners) listener();
}

function installed() {
  saved = null;
  rememberInstall();
  set("none");
  if (announced) return;
  announced = true;
  for (const listener of installedListeners) listener();
}

/** Starts listening for the browser's install prompt and for an install. */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    saved = event as BeforeInstallPromptEvent;
    set("ready");
  });
  window.addEventListener("appinstalled", installed);
}

export function promptState(): PromptState {
  return state;
}

export function subscribePrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Calls `listener` once, when the app is installed from this page. */
export function onInstalled(listener: () => void): () => void {
  installedListeners.add(listener);
  return () => installedListeners.delete(listener);
}

/** Shows the kept prompt. Call it straight from a tap. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = saved;
  if (!event) return "unavailable";
  saved = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") installed();
    else set("dismissed");
    return outcome;
  } catch {
    set("dismissed");
    return "dismissed";
  }
}
