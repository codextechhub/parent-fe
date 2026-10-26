import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { currentSchoolSlug } from "@/utils/school-host";

import { decideLink } from "./app-links";
import { checkoutReturned, isPaymentReturn } from "./checkout";
import { saveSchoolCode } from "./school-code";
import { lookUpSchool } from "./school-lookup";

type Pending = { code: string; name: string; path: string; switching: boolean };

/**
 * Opens the screen a school's link names, in the store app only.
 *
 * Listens for the links the phone hands the app (`appUrlOpen`, which also
 * delivers the link the app was launched by). A link for the school the app is
 * set to navigates; a link for another school, or for any school before one is
 * chosen, shows a confirmation that names the school, and only a tap on the
 * button changes the school, through the same steps as the school choice
 * screen: keep the code, then reload into it. A link to anything that is not a
 * school's parent app is ignored. The gateway's return to the payment result
 * closes the checkout browser first (`checkout.ts`).
 */
export function NativeLinks() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    let handle: { remove: () => Promise<void> } | null = null;

    const opened = async (link: string) => {
      const decision = decideLink(link, currentSchoolSlug());
      if (decision.kind === "go") {
        // The gateway's return: the checkout browser is closed before the result is shown.
        if (isPaymentReturn(decision.path)) await checkoutReturned();
        navigate(decision.path);
        return;
      }
      if (decision.kind !== "confirm") return;
      const found = await lookUpSchool(decision.code);
      if (!live || (!found.ok && found.reason === "not-found")) return;
      setPending({
        code: decision.code,
        name: found.ok ? found.name : decision.code,
        path: decision.path,
        switching: decision.switching,
      });
    };

    void import("@capacitor/app").then(async ({ App }) => {
      const added = await App.addListener("appUrlOpen", ({ url }) => void opened(url));
      if (live) handle = added;
      else void added.remove();
    });

    return () => {
      live = false;
      void handle?.remove();
    };
  }, [navigate]);

  if (!pending) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await saveSchoolCode(pending.code);
    } catch {
      setBusy(false);
      setPending(null);
      return;
    }
    window.location.replace(`${import.meta.env.BASE_URL}${pending.path.replace(/^\//, "")}`);
  };

  return (
    <main className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        {pending.switching ? "Switch school?" : "Use this school?"}
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        This link is for {pending.name}. {pending.switching ? "Switch to that school?" : "Use that school?"}
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button disabled={busy} onClick={() => void confirm()}>
          {pending.switching ? "Switch school" : "Use this school"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
          Not now
        </Button>
      </div>
    </main>
  );
}
