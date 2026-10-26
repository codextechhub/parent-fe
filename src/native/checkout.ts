/**
 * Card checkout in the store app.
 *
 * In a browser the parent is sent to the gateway's page and the gateway sends
 * them back to `/parent/fees/paid?reference=...` on the school's address. In
 * the store app that would carry the web view away from the app, so the
 * checkout opens in the phone's in-app browser (a Safari view controller on
 * iPhone, a Custom Tab on Android) and the app is returned to by one of two
 * routes:
 *
 * - **The return link.** The gateway's return address is the school's own
 *   `/parent/fees/paid` link, which the phone hands to the app
 *   (`native-links.tsx`). The app closes the browser and shows the result.
 * - **The parent closes the browser** (Done, or back) before any link arrives.
 *   The app then shows the same result screen for the checkout it opened.
 *
 * Neither route says whether the payment succeeded. The result screen asks the
 * API for the status of the payment's reference and shows what the API
 * answers: paid, still waiting for the bank, or not completed. Nothing in an
 * address, and nothing about how the browser was left, ever marks a payment
 * paid.
 */

/** The reference of the checkout now open in the browser, or null when none is. */
let open: string | null = null;

/** The result screen's address for a payment reference. */
export const resultPath = (reference: string): string => `/fees/paid?reference=${encodeURIComponent(reference)}`;

/** Whether an app path (the part after `/parent`) is the gateway's return to the result screen. */
export function isPaymentReturn(path: string): boolean {
  return /^\/fees\/paid\/?(?:[?#]|$)/.test(path);
}

/**
 * Opens `url` in the in-app browser and remembers which payment it is for.
 * Only an https address is opened. Rejects when the browser cannot be opened,
 * so the caller can tell the parent.
 */
export async function openCheckout(url: string, reference: string): Promise<void> {
  if (!/^https:\/\//i.test(url)) throw new Error("The checkout address is not secure.");
  const { Browser } = await import("@capacitor/browser");
  open = reference;
  try {
    await Browser.open({ url });
  } catch (error) {
    open = null;
    throw error;
  }
}

/**
 * The return link opened the app: closes the browser and forgets the open
 * checkout, so the browser closing does not also send the parent to the result.
 */
export async function checkoutReturned(): Promise<void> {
  if (open === null) return;
  open = null;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Android's Custom Tab has no close; the app being in front is enough.
  }
}

/**
 * The browser was closed. Answers the result screen's address for the
 * checkout that was open, once, or null when there is none (the return link
 * already took the parent there, or no checkout was started).
 */
export function checkoutClosed(): string | null {
  if (open === null) return null;
  const reference = open;
  open = null;
  return resultPath(reference);
}
