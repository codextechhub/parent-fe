import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Offers a new version of the app when one has downloaded.
 *
 * The app updates only when the parent says so, so a payment or an edit in
 * progress is never reloaded out from under them. Until they choose, the
 * version they opened keeps running.
 */
export function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
        onClick={() => updateServiceWorker(true)}
        className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
      >
        Update
      </button>
    </div>
  );
}
