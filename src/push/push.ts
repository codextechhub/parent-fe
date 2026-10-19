import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

import { pushApi, type ParentSubscription } from "@/redux/services/push-api";

import { pushChoice, setPushChoice } from "./push-choice";
import { browserFacts, isAppleMobile, runningInstalled } from "./situation";

/**
 * Push notifications for the signed-in parent on this browser.
 *
 * The browser holds one subscription for the whole app and the parent either
 * has it or does not: there is no sibling-switch complication here (unlike
 * student-fe). Turning push on asks the browser's permission from the tap
 * (required by iPhone), subscribes with the school's VAPID key and tells the
 * school. Turning it off tells the school to forget this parent's row.
 *
 * The browser's subscription itself is kept across sign-outs; the server-side
 * row is deleted. A fresh sign-in that chose `on` re-sends the subscription
 * on open, which is how the school learns a browser-rotated one.
 */

type Dispatch = ThunkDispatch<unknown, unknown, UnknownAction>;

/** How long to wait for the service worker before deciding this browser cannot push. */
const WORKER_WAIT_MS = 5000;

/** `/parent/fees` as the router's own path (`/fees`), never outside the app. */
export function routerPath(path: string): string {
  if (!path.startsWith("/parent/") && path !== "/parent") return "/";
  return path.slice("/parent".length) || "/";
}

export type PushSupport = "ready" | "install-first" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (isAppleMobile(browserFacts()) && !runningInstalled()) return "install-first";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "ready";
}

export function pushPermission(): NotificationPermission {
  return typeof Notification === "undefined" ? "default" : Notification.permission;
}

/** The school's public key as the bytes `applicationServerKey` takes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false;
  const have = new Uint8Array(current);
  return have.length === wanted.length && have.every((byte, i) => byte === wanted[i]);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function browserSubscription(dispatch: Dispatch): Promise<ParentSubscription | null> {
  const key = keyBytes(await dispatch(pushApi.endpoints.pushKey.initiate()).unwrap());
  const worker = await registration();
  if (!worker) return null;
  let subscription = await worker.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    // The school changed its key: the old subscription can no longer be sent to.
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export type TurnOnResult = { ok: true } | { ok: false; reason: "blocked" | "dismissed" | "failed" };

/**
 * Turns notifications on for the signed-in parent. Call it straight from the
 * tap: the permission prompt has to be the first thing the tap does, or iOS
 * refuses it.
 */
export async function turnOnPush(dispatch: Dispatch): Promise<TurnOnResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "blocked" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };
  try {
    const subscription = await browserSubscription(dispatch);
    if (!subscription) return { ok: false, reason: "failed" };
    await dispatch(pushApi.endpoints.subscribePush.initiate(subscription)).unwrap();
  } catch {
    return { ok: false, reason: "failed" };
  }
  setPushChoice("on");
  return { ok: true };
}

/** Turns push off for the signed-in parent. */
export async function turnOffPush(dispatch: Dispatch): Promise<boolean> {
  try {
    const worker = await registration();
    const subscription = await worker?.pushManager.getSubscription();
    if (subscription) {
      await dispatch(
        pushApi.endpoints.unsubscribePush.initiate({ endpoint: subscription.endpoint }),
      ).unwrap();
    }
  } catch {
    return false;
  }
  setPushChoice("off");
  return true;
}

/**
 * Re-sends the subscription on open, so a browser that has replaced its own
 * subscription (or the school's rotated key) is kept in step. Nothing is
 * asked of the parent and no toast is raised; a failure is tried next open.
 */
export async function refreshPush(dispatch: Dispatch): Promise<void> {
  if (pushChoice() !== "on" || pushSupport() !== "ready" || pushPermission() !== "granted")
    return;
  try {
    const subscription = await browserSubscription(dispatch);
    if (subscription)
      await dispatch(pushApi.endpoints.subscribePush.initiate(subscription)).unwrap();
  } catch {
    // Tried again next open.
  }
}

/**
 * Remove the server-side subscription row on sign-out. The browser-level
 * subscription is kept, so a different parent signing in on the same browser
 * can re-use it without triggering another permission prompt.
 *
 * Best effort: a sign-out never waits on the network.
 */
export async function dropPushOnSignOut(dispatch: Dispatch): Promise<void> {
  if (pushSupport() !== "ready") return;
  try {
    const worker = await registration();
    const subscription = await worker?.pushManager.getSubscription();
    if (subscription) {
      await dispatch(
        pushApi.endpoints.unsubscribePush.initiate({ endpoint: subscription.endpoint }),
      ).unwrap();
    }
  } catch {
    // Nothing to do; the backend's own 404/410 cleanup will catch it eventually.
  }
}
