import { Bell, Share, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { NativePushSetting } from "@/native/native-push-setting";
import { isNativeApp } from "@/native/platform";
import type { TurnOnResult } from "@/push/push";
import { usePush } from "@/push/use-push";
import { useAppSelector } from "@/redux/hooks";

/** What the app says after a tap on Turn on, by how it went. */
function sayTurnOn(result: TurnOnResult, firstName: string) {
  if (result.ok) {
    toast.success(`Notifications are on for ${firstName} on this browser.`);
  } else if (result.reason === "blocked") {
    toast.error(
      "Notifications are blocked for this app. Allow them in your browser's settings, then try again.",
    );
  } else if (result.reason === "failed") {
    toast.error("Notifications couldn't be turned on. Try again in a moment.");
  }
}

function useFirstName(): string {
  return useAppSelector((s) => s.auth.me?.parent.first_name) || "you";
}

const WHAT_THEY_SAY =
  "a confirmed payment, and whatever else the school sends. They never show marks or amounts.";

/**
 * The offer on Home, made once per parent per browser.
 *
 * Shown only to a parent who has not chosen yet, where the school sends push
 * and this browser can show it. On an iPhone outside the Home-Screen app the
 * offer is held back (the install card is Phase 7); the Profile setting
 * explains what to do until then. Turn on asks the browser's permission from
 * the tap; X dismisses.
 */
export function PushOffer() {
  const { state, busy, turnOn, notNow } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useFirstName();
  if (state !== "undecided") return null;

  return (
    <section
      aria-label="Get notifications"
      className="relative flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 pr-12"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 text-muted-foreground"
        aria-label="Close"
        onClick={notNow}
      >
        <X className="size-4" aria-hidden />
      </Button>
      <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-sm font-semibold text-foreground">Get notifications</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Be told on this browser about {WHAT_THEY_SAY}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || offline}
          onClick={async () => sayTurnOn(await turnOn(), firstName)}
        >
          {busy ? "Turning on" : "Turn on"}
        </Button>
      </div>
    </section>
  );
}

/**
 * The Notifications row on Profile for the signed-in parent (design 1k): a
 * switch while it can be turned on or off on this browser, otherwise a word
 * (blocked, add the app first, unavailable) with a line on what to do. The store app has its
 * own card for native push (`NativePushSetting`).
 */
export function PushSetting() {
  return isNativeApp() ? <NativePushSetting /> : <WebPushSetting />;
}

function WebPushSetting() {
  const { state, busy, turnOn, turnOff } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useFirstName();
  if (state === "loading") return null;

  const choosable = state === "on" || state === "off" || state === "undecided";
  const word = state === "blocked" ? "Blocked" : state === "install-first" ? "Add the app first" : "Unavailable";
  const set = async (on: boolean) => {
    if (on) return sayTurnOn(await turnOn(), firstName);
    if (await turnOff()) toast.success(`Notifications are off for ${firstName} on this browser.`);
    else toast.error("Notifications couldn't be turned off. Try again in a moment.");
  };

  return (
    <section className="settings-item" aria-labelledby="push-heading">
      <div className="settings-row">
        <span className="settings-icon is-amber"><Bell size={16} aria-hidden="true" /></span>
        <span className="settings-label" id="push-heading">Notifications<small>Payments, notices and messages</small></span>
        {choosable
          ? <ToggleSwitch on={state === "on"} disabled={busy || offline} onChange={(on) => void set(on)} label="Notifications on this browser" />
          : <span className="settings-value">{word}</span>}
      </div>
      {!choosable && (
        <div className="settings-panel settings-help">
          {state === "blocked" && <p>This browser has been told not to show notifications. Allow them in your browser&apos;s settings, then come back here.</p>}
          {state === "install-first" && <InstallSteps />}
          {state === "unavailable" && <p>Notifications aren&apos;t available on this browser.</p>}
        </div>
      )}
    </section>
  );
}

function InstallSteps() {
  return (
    <p>
      On an iPhone, notifications come to the app on your Home Screen. Tap{" "}
      <Share className="inline size-3.5 align-text-bottom" aria-label="Share" />, then{" "}
      <span className="font-medium">Add to Home Screen</span>, and open the app from there.
    </p>
  );
}
