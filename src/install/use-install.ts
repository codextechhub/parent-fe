import { useState, useSyncExternalStore } from "react";

import { appLabel, schoolAppName, subscribeSchoolName } from "@/lib/school-app";
import { useSchoolNameQuery } from "@/redux/services/school-api";
import { currentSchoolSlug } from "@/utils/school-host";

import { promptState, subscribePrompt } from "./install-prompt";
import { isInstalled, subscribeInstalled } from "./installed";
import { browserFacts, installSituation } from "./situation";

/**
 * The install offer's state for this device: whether it shows at all, and
 * which way of installing it describes.
 *
 * Nothing shows once the app is installed (`installed.ts`). Closing the Home
 * card (its X) puts it away on this device for good; the Profile row stays
 * until the app is installed. Storage that cannot be read reads as not put
 * away.
 */

const DISMISSED_KEY = "xvs.parent.install-offer-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useInstalled(): boolean {
  return useSyncExternalStore(subscribeInstalled, isInstalled);
}

export function useInstallOffer() {
  const installed = useInstalled();
  const prompt = useSyncExternalStore(subscribePrompt, promptState);
  const [dismissed, setDismissed] = useState(readDismissed);
  const situation = installSituation(browserFacts(), prompt);

  const putAway = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not kept: the card is offered again next time.
    }
    setDismissed(true);
  };

  return { installed, dismissed, situation, putAway };
}

/**
 * What the app is called on the home screen ("Meridian Parent"): the label
 * the page carries, else one made from the school's name, else "the app".
 */
export function useAppName(): string {
  const label = useSyncExternalStore(subscribeSchoolName, schoolAppName);
  const slug = currentSchoolSlug();
  const { data: schoolName } = useSchoolNameQuery(slug, { skip: !slug || !!label });
  return label || (schoolName ? appLabel(schoolName) : "the app");
}
