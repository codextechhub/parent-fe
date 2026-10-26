import { toast } from "sonner";

import type { TurnOnResult } from "./native-push-state";

/** What the app says after a tap on Turn on that did not turn it on. A refusal by the school is not said at all. */
export function sayNotOn(result: Extract<TurnOnResult, { ok: false }>) {
  if (result.reason === "blocked") {
    toast.error("Notifications are blocked for this app. Allow them in your phone's settings, then try again.");
  } else if (result.reason === "failed") {
    toast.error("Notifications couldn't be turned on. Try again in a moment.");
  }
}
