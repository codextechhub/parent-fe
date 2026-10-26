/**
 * The phone's side of native push: the operating system's permission, the
 * Firebase token of this install, and the events the messaging plugin raises.
 *
 * `@capacitor-firebase/messaging` gives an FCM token on Android and on iPhone
 * alike (the API sends every phone push through Firebase). Everything the rest
 * of the app needs from it passes through here, where tests replace it.
 */
import { FirebaseMessaging } from "./messaging-plugin";

/** The permission the phone's settings hold for this app. */
export type OsPermission = "granted" | "denied" | "prompt";

/** What a notification carries when it is shown or tapped: the data the API attached. */
export type PushPayload = { title: string; body: string; data: Record<string, unknown> };

type Plugin = typeof FirebaseMessaging;

function asPermission(state: string): OsPermission {
  if (state === "granted" || state === "denied") return state;
  return "prompt";
}

/** The current permission, without asking. An unreadable answer reads as not yet asked. */
export async function osPermission(): Promise<OsPermission> {
  try {
    return asPermission((await FirebaseMessaging.checkPermissions()).receive);
  } catch {
    return "prompt";
  }
}

/** Shows the phone's permission prompt (when it will still show one) and answers what the parent chose. */
export async function askOsPermission(): Promise<OsPermission> {
  try {
    return asPermission((await FirebaseMessaging.requestPermissions()).receive);
  } catch {
    return "denied";
  }
}

/** Firebase has no configuration file in this build (an iPhone build without `GoogleService-Info.plist`). */
export class FirebaseNotConfiguredError extends Error {}

/** This install's Firebase token. Rejects when Firebase cannot give one, with `FirebaseNotConfiguredError` when it has no configuration file. */
export async function deviceToken(): Promise<string> {
  let token: string | undefined;
  try {
    ({ token } = await FirebaseMessaging.getToken());
  } catch (error) {
    if (/not configured/i.test(String((error as { message?: unknown })?.message ?? error))) {
      throw new FirebaseNotConfiguredError("Firebase is not configured in this build.");
    }
    throw error;
  }
  if (!token) throw new Error("Firebase gave no token.");
  return token;
}

/** How long the start-up check waits for Firebase before it decides nothing. */
const CONFIGURED_WAIT_MS = 5000;

/**
 * Whether this build can use phone push at all. False only when Firebase says
 * it has no configuration file; any other answer, or none in time, decides
 * nothing and reads as configured.
 */
export async function firebaseConfigured(): Promise<boolean> {
  const answer = deviceToken().then(
    () => true,
    (error) => !(error instanceof FirebaseNotConfiguredError),
  );
  return Promise.race([answer, new Promise<boolean>((resolve) => setTimeout(() => resolve(true), CONFIGURED_WAIT_MS))]);
}

function payloadOf(notification: { title?: string; body?: string; data?: unknown }): PushPayload {
  const data = notification.data && typeof notification.data === "object" ? (notification.data as Record<string, unknown>) : {};
  return { title: notification.title ?? "", body: notification.body ?? "", data };
}

/** Runs `listener` for the rest of the app's life; the returned function stops it. */
async function listen(
  register: (messaging: Plugin) => Promise<{ remove: () => Promise<void> }>,
): Promise<() => void> {
  // The plugin is never the result of an await: a Capacitor plugin proxy answers `then` as a missing method.
  const handle = await register(FirebaseMessaging);
  return () => void handle.remove();
}

/** The token changed (Firebase issued a new one): the new token. */
export const onTokenChange = (listener: (token: string) => void) =>
  listen((m) => m.addListener("tokenReceived", ({ token }) => listener(token)));

/**
 * A notification was tapped. A tap that launched the app is held by the plugin
 * until a listener is added, so this also delivers the one that opened the app.
 */
export const onTap = (listener: (payload: PushPayload) => void) =>
  listen((m) =>
    m.addListener("notificationActionPerformed", ({ actionId, notification }) => {
      if (actionId === "tap") listener(payloadOf(notification));
    }),
  );

/** A notification arrived while the app was open. */
export const onForeground = (listener: (payload: PushPayload) => void) =>
  listen((m) => m.addListener("notificationReceived", ({ notification }) => listener(payloadOf(notification))));
