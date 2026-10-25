import { useEffect } from "react";
import { useNavigate } from "react-router";

import { refreshDepositWatch } from "@/lib/use-deposit-watch";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";

import { refreshPush, routerPath } from "./push";

/** What the service worker posts when a notification is tapped while the app is open. */
type OpenMessage = { type: "xvs-parent-push-open"; path: string };

const isOpenMessage = (data: unknown): data is OpenMessage =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === "xvs-parent-push-open";

/** What the service worker posts when a push arrives while the app is open. */
type ReceivedMessage = { type: "xvs-parent-push-received"; tag: string };

const isReceivedMessage = (data: unknown): data is ReceivedMessage =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === "xvs-parent-push-received";

/** The push tag for a booked payment ("Payment received"). */
const PAYMENT_RECEIVED = "billing.payment_received";

/**
 * Keeps push working for the signed-in parent, and answers a tapped
 * notification.
 *
 * On every sign-in the subscription is re-sent so a browser that rotated its
 * endpoint reaches the school. A tap on a notification while the app is
 * already open arrives here from the service worker: the right screen is
 * routed to. A "Payment received" push arriving while the app is open reads
 * balances and the watched transfers again at once. Renders nothing.
 */
export function PushListener() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const signedIn = useAppSelector((s) => !!s.auth.me);

  useEffect(() => {
    if (signedIn) void refreshPush(dispatch);
  }, [dispatch, signedIn]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (isReceivedMessage(event.data)) {
        if (event.data.tag !== PAYMENT_RECEIVED) return;
        dispatch(baseApi.util.invalidateTags(["Fees", "Me", "Payments", "PaymentNotices"]));
        refreshDepositWatch();
        return;
      }
      if (!isOpenMessage(event.data)) return;
      navigate(routerPath(event.data.path));
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [dispatch, navigate]);

  return null;
}
