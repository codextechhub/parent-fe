/** The push tag for a booked payment ("Payment received"). */
export const PAYMENT_RECEIVED = "billing.payment_received";

/**
 * Whether a push's data is "Payment received": its kind says so, or the screen
 * it opens is one of the parent's receipts.
 */
export function isPaymentPush(data: { tag?: unknown; url?: unknown }): boolean {
  if (data.tag === PAYMENT_RECEIVED) return true;
  return typeof data.url === "string" && /^\/parent\/fees\/receipts\/\d+(?:[?#]|$)/.test(data.url);
}
