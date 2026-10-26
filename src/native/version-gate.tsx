import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  checkForUpdate,
  rememberDismissedLatest,
  shouldCheckAgain,
  type VersionNotice,
} from "./app-version";
import { nativePlatform } from "./platform";

/** Opens the store page in the phone's store, not in the app's own web view. */
async function openStore(url: string): Promise<void> {
  if (!url) return;
  try {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url });
  } catch {
    window.open(url, "_system");
  }
}

/**
 * The version check's screens, in the store app only.
 *
 * It asks when the app opens and again when the parent returns to it, but not
 * more than every few hours. A required update covers the whole app with one
 * screen and one button; an available one is a small note over the top of the
 * screen that can be dismissed, and stays dismissed until a newer version is
 * published. A check that gets no answer changes nothing.
 */
export function VersionGate() {
  const [notice, setNotice] = useState<VersionNotice>(null);
  const lastCheck = useRef<number | null>(null);

  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    let live = true;
    let handle: { remove: () => Promise<void> } | null = null;

    const run = async () => {
      lastCheck.current = Date.now();
      const answer = await checkForUpdate(platform);
      if (live && answer !== undefined) setNotice(answer);
    };
    void run();

    void import("@capacitor/app").then(async ({ App }) => {
      const added = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && shouldCheckAgain(lastCheck.current, Date.now())) void run();
      });
      if (live) handle = added;
      else void added.remove();
    });

    return () => {
      live = false;
      void handle?.remove();
    };
  }, []);

  if (!notice) return null;

  if (notice.kind === "required") {
    return (
      <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <img
          src={`${import.meta.env.BASE_URL}svg/xvs-logo.svg`}
          alt=""
          width={64}
          height={81}
          className="h-20 w-auto select-none"
          draggable={false}
        />
        <h1 className="text-lg font-semibold text-foreground">Update XVS Parent</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          This version of XVS Parent is no longer supported. Update it to keep using it.
        </p>
        {notice.storeUrl && (
          <Button className="w-full max-w-xs" onClick={() => void openStore(notice.storeUrl)}>
            Update
          </Button>
        )}
      </main>
    );
  }

  const dismiss = () => {
    void rememberDismissedLatest(notice.latest);
    setNotice(null);
  };
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[max(env(safe-area-inset-top),0.75rem)] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-xs shadow-lg"
    >
      <span className="min-w-0 flex-1 text-foreground">A new version of XVS Parent is available.</span>
      {notice.storeUrl && (
        <button
          type="button"
          onClick={() => void openStore(notice.storeUrl)}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
        >
          Update
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
