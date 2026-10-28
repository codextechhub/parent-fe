import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useAppSelector } from "@/redux/hooks";

import { turnOff, turnOn, useNativePush } from "./native-push-state";
import { sayNotOn } from "./push-say";

/**
 * The Notifications row on Profile in the store app (design 1k): a switch
 * while it can be turned on or off, otherwise a word (blocked in the phone's
 * settings, or not offered by the school yet) with a line on what to do.
 * Turning notifications on from here goes straight to the phone's permission
 * prompt: the parent has just asked for it. A phone that has been told no
 * cannot be asked again from inside the app, so the row says where to allow
 * it.
 */
export function NativePushSetting() {
  const { state } = useNativePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [busy, setBusy] = useState(false);
  if (state === "loading") return null;

  const on = async () => {
    setBusy(true);
    try {
      const result = await turnOn();
      if (result.ok) toast.success("Notifications are on for this device.");
      else sayNotOn(result);
    } finally {
      setBusy(false);
    }
  };

  const off = async () => {
    setBusy(true);
    try {
      await turnOff();
      toast.success("Notifications are off for this device.");
    } finally {
      setBusy(false);
    }
  };

  const choosable = state === "on" || state === "off" || state === "undecided";

  return (
    <section className="settings-item" aria-labelledby="push-heading">
      <div className="settings-row">
        <span className="settings-icon is-amber"><Bell size={16} aria-hidden="true" /></span>
        <span className="settings-label" id="push-heading">Notifications<small>Payments, notices and messages</small></span>
        {choosable
          ? <ToggleSwitch on={state === "on"} disabled={busy || offline} onChange={(next) => void (next ? on() : off())} label="Notifications on this device" />
          : <span className="settings-value">{state === "blocked" ? "Blocked" : "Unavailable"}</span>}
      </div>
      {!choosable && (
        <div className="settings-panel settings-help">
          {state === "blocked" && <p>Notifications are not allowed for this app. Open your phone&apos;s Settings, find XVS Parent, allow notifications, then come back here.</p>}
          {state === "unavailable" && <p>Your school doesn&apos;t send notifications to phones yet.</p>}
        </div>
      )}
    </section>
  );
}
