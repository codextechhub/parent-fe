/** How often an open app asks whether a new version has been released. */
export const UPDATE_CHECK_EVERY_MS = 60 * 60 * 1000;

/** The least time between two checks, so flicking between apps does not ask on every return. */
export const UPDATE_CHECK_GAP_MS = 60 * 1000;

/**
 * Keeps asking the server whether a new version of the app has been released.
 *
 * A browser looks for a new service worker only when the app's page loads in
 * full. An installed app on a phone is usually resumed from the background
 * rather than loaded, and on an iPhone it is loaded only when the parent closes
 * it fully, so a new version could go unnoticed for days. This asks again
 * every time the parent returns to the app and every hour while it stays open.
 * A version it finds downloads in the background and the update bar offers
 * it; nothing reloads until the parent chooses.
 *
 * A check is skipped while one is already downloading, while the device is
 * offline, and within a minute of the last one. Returns a function that stops
 * the checks.
 */
export function keepCheckingForUpdates(
  registration: { update: () => Promise<unknown>; installing: ServiceWorker | null },
  now: () => number = Date.now,
): () => void {
  let lastCheck = now();

  const check = () => {
    if (registration.installing || !navigator.onLine) return;
    if (now() - lastCheck < UPDATE_CHECK_GAP_MS) return;
    lastCheck = now();
    void registration.update().catch(() => {
      // The server could not be reached: the next return or the next hour asks again.
    });
  };
  const onReturn = () => {
    if (document.visibilityState === "visible") check();
  };

  const timer = window.setInterval(check, UPDATE_CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", onReturn);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onReturn);
  };
}
