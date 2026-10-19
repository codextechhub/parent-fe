import { useEffect, type ReactNode } from "react";
import { Copy, Download, ExternalLink, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { onInstalled, promptInstall } from "@/install/install-prompt";
import { browserFacts, isAndroid, type InstallSituation } from "@/install/situation";
import { useAppName, useInstallOffer } from "@/install/use-install";

/**
 * "Get the app": how to put the app on this device's home screen, said for
 * the browser in hand, so a parent never has to know how their browser does it.
 *
 * The Home card and the Profile row show only where the app is not installed
 * (`install/installed.ts`), and say exactly one thing by situation
 * (`install/situation.ts`): an Install button where the browser gave a
 * prompt, Safari's three steps on an iPhone, "open this page in Chrome" or
 * "in Safari" with Copy link in a browser that cannot install (and on Android
 * an Open in Chrome button that hands the page straight to Chrome), and the
 * browser's menu anywhere else. The card's X puts it away on this device for
 * good; the Profile row stays until the app is installed. The app's address
 * is never shown as text: Open in Chrome and Copy link carry it.
 *
 * On an iPhone this card comes before the notifications offer, which waits
 * for the installed app, because only that gets notifications there.
 */
export function InstallOffer() {
  const { installed, dismissed, situation, putAway } = useInstallOffer();
  const appName = useAppName();
  if (installed || dismissed) return null;

  return (
    <section
      aria-label="Get the app"
      className="relative flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 pr-12"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 text-muted-foreground"
        aria-label="Close"
        onClick={putAway}
      >
        <X className="size-4" aria-hidden />
      </Button>
      <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-sm font-semibold text-foreground">Get the app</h2>
        <InstallHow situation={situation} appName={appName} />
      </div>
      {hasAction(situation) && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <InstallAction situation={situation} />
        </div>
      )}
    </section>
  );
}

/** The install row on Profile, kept until the app is installed on this device. */
export function InstallSetting() {
  const { installed, situation } = useInstallOffer();
  const appName = useAppName();
  if (installed) return null;

  return (
    <section aria-label="Install the app" className="min-w-0 rounded-xl border border-border p-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Install the app</h2>
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <InstallHow situation={situation} appName={appName} />
        </div>
        {hasAction(situation) && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <InstallAction situation={situation} />
          </div>
        )}
      </div>
    </section>
  );
}

/** Says "<School> is on your home screen." once the app is installed from this page. */
export function InstallListener() {
  const appName = useAppName();
  useEffect(
    () => onInstalled(() => toast.success(`${appName.charAt(0).toUpperCase()}${appName.slice(1)} is on your home screen.`)),
    [appName],
  );
  return null;
}

const NOTIFICATIONS_LINE = "Notifications only work in the installed app.";

function Line({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>;
}

function InstallHow({ situation, appName }: { situation: InstallSituation; appName: string }) {
  switch (situation) {
    case "prompt":
      return <Line>Put {appName} on your home screen and open it like any other app.</Line>;
    case "prompt-dismissed":
      return (
        <Line>
          To install {appName}, use your browser&apos;s menu: <span className="font-medium text-foreground">Install app</span>.
        </Line>
      );
    case "ios-safari":
      return (
        <>
          <Line>Put {appName} on your Home Screen:</Line>
          <ol className="mt-2 space-y-1.5 text-xs text-foreground">
            <Step n={1} icon={<Share className="size-4" aria-hidden />}>Tap Share</Step>
            <Step n={2} icon={<SquarePlus className="size-4" aria-hidden />}>Tap Add to Home Screen</Step>
            <Step n={3}>Tap Add</Step>
          </ol>
          <Line>{NOTIFICATIONS_LINE} Not in the list? Open this page in Safari first.</Line>
        </>
      );
    case "open-in-safari":
      return (
        <>
          <Line>To install the app, open this page in Safari.</Line>
          <Line>{NOTIFICATIONS_LINE}</Line>
        </>
      );
    case "open-in-chrome":
      return (
        <>
          <Line>To install the app, open this page in Chrome.</Line>
        </>
      );
    case "menu":
      return (
        <Line>
          To install {appName}, use your browser&apos;s menu:{" "}
          <span className="font-medium text-foreground">Install app</span> or{" "}
          <span className="font-medium text-foreground">Add to Home screen</span>.
        </Line>
      );
  }
}

function Step({ n, icon, children }: { n: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
      {icon && <span className="text-primary">{icon}</span>}
    </li>
  );
}

/** The app's own address, which Open in Chrome and Copy link hand on. */
function appAddress(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

function hasAction(situation: InstallSituation): boolean {
  return situation === "prompt" || situation === "open-in-safari" || situation === "open-in-chrome";
}

/**
 * An address Android opens in Chrome from any other browser or app: an
 * intent link naming Chrome's package. Where Chrome is missing, what happens
 * is the browser's choice, so Copy link stays beside it.
 */
export function chromeIntentUrl(address: string): string {
  const url = new URL(address);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
}

/** The buttons a situation has: Install where the browser gave a prompt, Open in Chrome and Copy link where it cannot install. */
function InstallAction({ situation }: { situation: InstallSituation }) {
  if (situation === "prompt") {
    return (
      <Button size="sm" onClick={() => void promptInstall()}>
        <Download className="size-4" aria-hidden /> Install app
      </Button>
    );
  }
  if (situation === "open-in-safari" || situation === "open-in-chrome") {
    return (
      <>
        {situation === "open-in-chrome" && isAndroid(browserFacts()) && (
          <Button size="sm" asChild>
            <a href={chromeIntentUrl(appAddress())}>
              <ExternalLink className="size-4" aria-hidden /> Open in Chrome
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (await copyText(appAddress())) toast.success("Link copied");
            else {
              const browser = situation === "open-in-safari" ? "Safari" : "Chrome";
              toast.error(`The link couldn't be copied. Use this browser's menu to open the page in ${browser}.`);
            }
          }}
        >
          <Copy className="size-4" aria-hidden /> Copy link
        </Button>
      </>
    );
  }
  return null;
}

/** Copies `text`, through the old copy command where an app's browser has no clipboard. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Falls through to the copy command.
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}
