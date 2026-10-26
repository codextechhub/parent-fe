import { useEffect, useSyncExternalStore } from "react";

import { pushChoice, setPushChoice, type PushChoice } from "@/push/push-choice";

import {
  askOsPermission,
  deviceToken,
  firebaseConfigured,
  FirebaseNotConfiguredError,
  osPermission,
  type OsPermission,
} from "./push-device";
import { nativePlatform } from "./platform";
import { forgetDevice, registerDevice } from "./push-register";

/**
 * Native push for the parent on this phone: what the app knows, and the moves
 * that change it.
 *
 * Three things decide where notifications stand. The phone's permission is
 * the same for every app user. Whether the school sends phone push at all is
 * learned from the first registration it refuses, and holds for the rest of
 * the run. And the parent's own choice, kept in `push/push-choice`: `on` once
 * they turned notifications on, `off` after turning them off, `not-now` once
 * they put the offer away or the school had none to give. A parent with no
 * choice is offered notifications once.
 */

/** Where notifications stand for the parent. */
export type NativePushState = "loading" | "unavailable" | "blocked" | "undecided" | "on" | "off";

export function nativePushState(input: {
  permission: OsPermission | "unknown";
  unavailable: boolean;
  choice: PushChoice | null;
}): NativePushState {
  const { permission, unavailable, choice } = input;
  if (permission === "unknown") return "loading";
  if (unavailable) return "unavailable";
  if (permission === "denied") return "blocked";
  if (choice === "on") return permission === "granted" ? "on" : "off";
  return choice ? "off" : "undecided";
}

type Snapshot = { permission: OsPermission | "unknown"; unavailable: boolean; revision: number };

let snapshot: Snapshot = { permission: "unknown", unavailable: false, revision: 0 };
const listeners = new Set<() => void>();

function change(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next, revision: snapshot.revision + 1 };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const getSnapshot = () => snapshot;

/** The token the phone was last registered under in this run, so an unchanged one is not sent again. */
let registered = "";

/** Runs moves one after another, so a token change and a tap on Turn on never register at once. */
let tail: Promise<unknown> = Promise.resolve();
function inOrder<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work);
  tail = next.catch(() => undefined);
  return next;
}

/** Resets what the run has learned. For tests. */
export function resetNativePushState(): void {
  snapshot = { permission: "unknown", unavailable: false, revision: 0 };
  registered = "";
  probed = false;
  tail = Promise.resolve();
}

/** Reads the phone's permission into the state; call it at start and whenever the app comes back to the front. */
export async function readPermission(): Promise<OsPermission> {
  const permission = await osPermission();
  if (permission !== snapshot.permission) change({ permission });
  return permission;
}

export type TurnOnResult = { ok: true } | { ok: false; reason: "blocked" | "dismissed" | "unavailable" | "failed" };

/**
 * Turns notifications on: asks the phone's permission if it has not been
 * given, takes the install's token and registers it for the parent. Call it
 * from a tap, after the in-app explanation.
 */
export function turnOn(): Promise<TurnOnResult> {
  return inOrder(async () => {
    let permission = await osPermission();
    if (permission === "prompt") permission = await askOsPermission();
    change({ permission });
    if (permission === "denied") return { ok: false, reason: "blocked" };
    if (permission !== "granted") return { ok: false, reason: "dismissed" };
    let token: string;
    try {
      token = await deviceToken();
    } catch (error) {
      if (error instanceof FirebaseNotConfiguredError) {
        change({ unavailable: true });
        return { ok: false, reason: "unavailable" };
      }
      return { ok: false, reason: "failed" };
    }
    const result = await registerDevice(token);
    if (result === "unavailable") {
      // The offer is put away: the school has none to give yet, and turning it on later asks again.
      setPushChoice("not-now");
      change({ unavailable: true });
      return { ok: false, reason: "unavailable" };
    }
    if (result === "failed") return { ok: false, reason: "failed" };
    registered = token;
    setPushChoice("on");
    change({});
    return { ok: true };
  });
}

let probed = false;

/**
 * Finds out, once per run and only when the offer or the setting is about to
 * show, whether an iPhone build has its Firebase file. A build without it
 * cannot do phone push, so the state reads Unavailable instead of offering
 * something that cannot work.
 */
function probeFirebase(): void {
  if (probed || nativePlatform() !== "ios") return;
  probed = true;
  void firebaseConfigured().then((ok) => {
    if (!ok) change({ unavailable: true });
  });
}

/** Turns notifications off for this phone. */
export async function turnOff(): Promise<void> {
  await forgetDevice();
  registered = "";
  setPushChoice("off");
  change({});
}

/** Puts the offer away. */
export function notNow(): void {
  setPushChoice("not-now");
  change({});
}

/**
 * Registers the phone again when the parent has notifications on.
 *
 * Runs when the app starts and the parent is signed in, when the app returns
 * to the front and when Firebase issues a new token (passed in as `token`). A
 * phone already registered under the same token is skipped. Nothing is asked
 * of the parent and nothing is said if it fails: it is tried again the next
 * time. Once the school says it sends no phone push, it is not tried again.
 */
export function syncDevice(token?: string): Promise<void> {
  return inOrder(async () => {
    if (pushChoice() !== "on" || snapshot.unavailable) return;
    if ((await osPermission()) !== "granted") return;
    let current = token;
    if (!current) {
      try {
        current = await deviceToken();
      } catch {
        return;
      }
    }
    if (registered === current) return;
    const result = await registerDevice(current);
    if (result === "ok") registered = current;
    if (result === "unavailable") change({ unavailable: true });
  });
}

/** The state of notifications for the parent, redrawn when anything above changes. */
export function useNativePush(): { state: NativePushState } {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(probeFirebase, []);
  return {
    state: nativePushState({
      permission: current.permission,
      unavailable: current.unavailable,
      choice: pushChoice(),
    }),
  };
}
