/**
 * Stands in for `virtual:pwa-register/react` in the native build, where the
 * PWA plugin (and so the virtual module) does not exist. The store app has no
 * service worker, so nothing is ever registered and no update is ever waiting;
 * the app updates through the stores.
 */
export function useRegisterSW(_options?: unknown) {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async (_reload?: boolean) => {},
  };
}
