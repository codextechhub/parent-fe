import { useSyncExternalStore } from "react";

import { schoolFullName, subscribeSchoolName } from "./school-app";

/**
 * The school's full name ("Meridian Crest Academy"): the one the page is
 * named with, or "" while it is being read.
 *
 * Phase 1 reads the name from the school-app subscription alone, which
 * `applySchoolApp` fills from the school's own manifest (or from the public
 * name endpoint when the manifest is not served). An RTK Query fallback the
 * student app also carries will be added back when the parent portal's
 * reads land, in Phase 2.
 */
export function useSchoolName(): string {
  return useSyncExternalStore(subscribeSchoolName, schoolFullName);
}
