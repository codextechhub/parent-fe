import { useEffect } from "react";
import { useNavigate } from "react-router";

import { checkoutClosed } from "./checkout";

/**
 * Brings the parent to the payment result when they close the checkout browser
 * themselves, in the store app only.
 *
 * `browserFinished` is raised whenever the in-app browser goes away. If the
 * return link already opened the app, it has taken the parent to the result and
 * forgotten the checkout, so this finds nothing to do. Otherwise the parent is
 * shown the result screen for the checkout they left, which asks the API what
 * became of the payment. Renders nothing.
 */
export function NativeCheckoutReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    let handle: { remove: () => Promise<void> } | null = null;

    void import("@capacitor/browser").then(async ({ Browser }) => {
      const added = await Browser.addListener("browserFinished", () => {
        const target = checkoutClosed();
        if (target) navigate(target);
      });
      if (live) handle = added;
      else void added.remove();
    });

    return () => {
      live = false;
      void handle?.remove();
    };
  }, [navigate]);

  return null;
}
