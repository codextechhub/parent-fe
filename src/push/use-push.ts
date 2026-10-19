import { useEffect, useState } from "react";

import { useAppDispatch } from "@/redux/hooks";
import { usePushKeyQuery } from "@/redux/services/push-api";

import { pushChoice, setPushChoice, type PushChoice } from "./push-choice";
import { pushPermission, pushSupport, turnOffPush, turnOnPush, type TurnOnResult } from "./push";

/**
 * Where notifications stand for the signed-in parent, on this browser.
 *
 * - `unavailable`: this browser cannot show them, or the school sends none.
 * - `install-first`: an iPhone in Safari, where only the Home-Screen app gets them.
 * - `blocked`: the browser's permission was refused; only its settings undo that.
 * - `undecided`: the parent has not been asked yet.
 * - `on` / `off`: what the parent chose.
 */
export type PushState =
  | "loading"
  | "unavailable"
  | "install-first"
  | "blocked"
  | "undecided"
  | "on"
  | "off";

export function pushStateFrom(input: {
  support: ReturnType<typeof pushSupport>;
  keyState: "loading" | "ready" | "missing";
  permission: NotificationPermission;
  choice: PushChoice | null;
}): PushState {
  const { support, keyState, permission, choice } = input;
  if (support === "unsupported") return "unavailable";
  if (keyState === "loading") return "loading";
  if (keyState === "missing") return "unavailable";
  if (support === "install-first") return "install-first";
  if (permission === "denied") return "blocked";
  if (choice === "on") return permission === "granted" ? "on" : "off";
  if (choice) return "off";
  return "undecided";
}

/**
 * Watches the browser's `permission` for an outside change (the parent
 * allowed or blocked notifications in Settings while this app was open).
 */
function usePermissionWatcher(): NotificationPermission {
  const [permission, setPermission] = useState<NotificationPermission>(pushPermission);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.navigator === "undefined") return;
    let status: PermissionStatus | null = null;
    const read = () => setPermission(pushPermission());
    window.navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((result) => {
        status = result;
        read();
        result.addEventListener("change", read);
      })
      .catch(() => {});
    return () => {
      status?.removeEventListener("change", read);
    };
  }, []);
  return permission;
}

export function usePush() {
  const dispatch = useAppDispatch();
  const support = pushSupport();
  const key = usePushKeyQuery(undefined, { skip: support === "unsupported" });
  const [choice, setChoice] = useState<PushChoice | null>(() => pushChoice());
  const permission = usePermissionWatcher();
  const [busy, setBusy] = useState(false);

  const state = pushStateFrom({
    support,
    keyState: key.isSuccess ? "ready" : key.isError ? "missing" : "loading",
    permission,
    choice,
  });

  const turnOn = async (): Promise<TurnOnResult> => {
    setBusy(true);
    const result = await turnOnPush(dispatch);
    if (result.ok) setChoice("on");
    setBusy(false);
    return result;
  };

  const turnOff = async (): Promise<boolean> => {
    setBusy(true);
    const done = await turnOffPush(dispatch);
    if (done) setChoice("off");
    setBusy(false);
    return done;
  };

  const notNow = () => {
    setPushChoice("not-now");
    setChoice("not-now");
  };

  return { state, busy, turnOn, turnOff, notNow };
}
