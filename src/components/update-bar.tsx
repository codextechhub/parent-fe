import { useRegisterSW } from "virtual:pwa-register/react";

import { keepCheckingForUpdates } from "@/install/update-check";

/**
 * Offers a new version of the app when one has downloaded.
 *
 * The app updates only when the parent says so, so a payment or an edit in
 * progress is never reloaded out from under them. Until they choose, the
 * version they opened keeps running. The app asks for a new version each time
 * the parent returns to it and every hour while it is open
 * (`keepCheckingForUpdates`), so the offer does not wait for a full restart.
 */
/**
 * Switches to the new version and reloads into it.
 *
 * The page is reloaded here, once the new version controls it, rather than
 * left to the plugin: the plugin reloads only for a version it found when the
 * app opened, and a version found later by the hourly or on-return check is
 * one it treats as found elsewhere, so the new version would take over
 * unseen while the screen kept showing the old one.
 */
function update(updateServiceWorker: (reload?: boolean) => Promise<void>) {
  let reloaded = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  void updateServiceWorker(true);
}

export function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) keepCheckingForUpdates(registration);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-xs shadow-lg"
    >
      <span className="min-w-0 flex-1 text-foreground">A new version of the app is ready.</span>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="font-medium text-muted-foreground"
      >
        Later
      </button>
      <button
        type="button"
        onClick={() => update(updateServiceWorker)}
        className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
      >
        Update
      </button>
    </div>
  );
}
