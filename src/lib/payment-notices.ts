/**
 * Where a "payment received" notice from the school opens.
 *
 * The notice is the school's in-app row for the event `billing.payment_received`.
 * Its `action_url` names this app's own receipt (`/parent/fees/receipts/<payment id>`),
 * which the router knows without the app prefix. A row without one, or with
 * an address that is not a receipt in this app, opens Fees, where every
 * payment is listed.
 */

/** The event key of a booked payment's notice. */
export const PAYMENT_RECEIVED_EVENT = "billing.payment_received";

const RECEIPT_URL = /^\/parent\/fees\/receipts\/(\d+)\/?$/;

/** The router path a notice opens: its receipt, or Fees when the address is not one. */
export function noticePath(actionUrl: string | undefined): string {
  const id = RECEIPT_URL.exec(actionUrl ?? "")?.[1];
  return id ? `/fees/receipts/${id}` : "/fees";
}
