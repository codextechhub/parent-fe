import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { refreshDepositWatch } from "@/lib/use-deposit-watch";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";

import { notNow, readPermission, syncDevice, turnOn, useNativePush } from "./native-push-state";
import { nativePlatform } from "./platform";
import { onForeground, onTap, onTokenChange, type PushPayload } from "./push-device";
import { isPaymentPush } from "./payment-push";
import { sayNotOn } from "./push-say";
import { tapTarget } from "./push-routing";

/**
 * Native push for the store app, mounted once inside the router.
 *
 * - **Registering.** A parent who turned notifications on is registered with
 *   the school when the app starts and they are signed in, when the app comes
 *   back to the front and when Firebase issues a new token.
 * - **A tapped notification.** The screen it names opens, on the child it is
 *   about where it is a per-child screen. A tap that launched the app waits
 *   for the session to open first.
 * - **An open app.** The iPhone shows the banner itself. Android shows nothing
 *   for an app in front, so a toast stands in. A "Payment received" push, and
 *   the app returning to the front, make the fees and the watched transfers
 *   read again at once.
 * - **The offer.** A parent who has not chosen is shown a short explanation
 *   before the phone's own permission prompt (`NativePushOffer`).
 */
export function NativePushListener() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const signedIn = useAppSelector((s) => !!s.auth.me);
  const checked = useAppSelector((s) => s.auth.checked);
  const waiting = useRef<PushPayload | null>(null);

  const open = useEffectEvent((payload: PushPayload) => navigate(tapTarget(payload.data).path));
  const tapped = useEffectEvent((payload: PushPayload) => {
    if (signedIn) open(payload);
    else waiting.current = payload;
  });
  const tokenChanged = useEffectEvent((token: string) => void syncDevice(token));
  const returned = useEffectEvent(() => void readPermission().then(() => syncDevice()));
  const paymentArrived = useEffectEvent(() => {
    dispatch(baseApi.util.invalidateTags(["Fees", "Me", "Payments", "PaymentNotices"]));
    refreshDepositWatch();
  });

  // The phone's side: listeners that live as long as the app does.
  useEffect(() => {
    if (!nativePlatform()) return;
    let live = true;
    const stops: Array<() => void> = [];
    const keep = (stop: () => void) => (live ? stops.push(stop) : stop());

    void readPermission();
    void onTokenChange(tokenChanged).then(keep, () => undefined);
    void onTap(tapped).then(keep, () => undefined);
    void onForeground(({ title, body, data }) => {
      if (isPaymentPush(data)) paymentArrived();
      if (nativePlatform() === "android" && (title || body)) toast(title || body, title && body ? { description: body } : undefined);
    }).then(keep, () => undefined);
    void import("@capacitor/app").then(async ({ App }) => {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          returned();
          refreshDepositWatch();
        }
      });
      keep(() => void handle.remove());
    });

    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, []);

  // A tap that arrived before the session opened is answered once it has, or dropped if nobody is signed in.
  useEffect(() => {
    if (!checked) return;
    const payload = waiting.current;
    waiting.current = null;
    if (payload && signedIn) open(payload);
  }, [checked, signedIn]);

  // Signed in: register the phone if notifications are on.
  useEffect(() => {
    if (signedIn && nativePlatform()) void syncDevice();
  }, [signedIn]);

  return <NativePushOffer />;
}

/**
 * The one-time offer to a signed-in parent, before the phone asks anything.
 *
 * Shown where the parent has not chosen, the phone has not been told no and
 * the school sends phone push. Turn on goes on to the phone's permission
 * prompt; Not now puts the offer away for good, and Profile keeps the setting
 * for later. Not shown offline, since turning on needs the school.
 */
function NativePushOffer() {
  const { state } = useNativePush();
  const signedIn = useAppSelector((s) => !!s.auth.me);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useAppSelector((s) => s.auth.me?.parent.first_name);
  const [busy, setBusy] = useState(false);
  if (!signedIn || state !== "undecided" || offline) return null;

  const turnOnNow = async () => {
    setBusy(true);
    try {
      const result = await turnOn();
      if (!result.ok) sayNotOn(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      aria-label="Get notifications"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"
    >
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Bell className="size-7" aria-hidden />
      </span>
      <h1 className="max-w-xs text-lg font-semibold text-foreground">
        Get a notification when results, notices or payments arrive
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {firstName ? `${firstName}, your` : "Your"} phone will ask you to allow notifications next. They never show marks
        or amounts, and you can turn them off any time in your profile.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button disabled={busy} onClick={() => void turnOnNow()}>
          {busy ? "Turning on" : "Turn on notifications"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => notNow()}>
          Not now
        </Button>
      </div>
    </main>
  );
}
