import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/redux/hooks";

import { turnOff, turnOn, useNativePush } from "./native-push-state";
import { sayNotOn } from "./push-say";

/**
 * The notifications setting on Profile in the store app.
 *
 * It says where things stand (on, off, blocked in the phone's settings, or
 * not offered by the school yet) and offers the one action that applies.
 * Turning notifications on from here goes straight to the phone's permission
 * prompt: the parent has just asked for it. A phone that has been told no
 * cannot be asked again from inside the app, so the card says where to allow
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

  return (
    <section className="profile-surface profile-notifications">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><Bell size={19} aria-hidden="true" /></span>
        <div><h2>Notifications on this device</h2><p>A setting for this device</p></div>
      </div>
      <div className="profile-notification-body">
        <div>
          {state === "on" && <p><strong>On.</strong> You&apos;ll hear about new notices, released results and confirmed payments.</p>}
          {(state === "off" || state === "undecided") && <p><strong>Off.</strong> Turn on notifications to hear about new notices, released results and confirmed payments.</p>}
          {state === "blocked" && <p><strong>Blocked.</strong> Notifications are not allowed for this app. Open your phone&apos;s Settings, find XVS Parent, allow notifications, then come back here.</p>}
          {state === "unavailable" && <p><strong>Unavailable.</strong> Your school doesn&apos;t send notifications to phones yet.</p>}
        </div>
        {state === "on" && <Button disabled={busy || offline} onClick={() => void off()}>{busy ? "Turning off" : "Turn off"}</Button>}
        {(state === "off" || state === "undecided") && <Button disabled={busy || offline} onClick={() => void on()}>{busy ? "Turning on" : "Turn on"}</Button>}
      </div>
      <p className="profile-notification-help">Notifications never show marks or amounts.</p>
    </section>
  );
}
