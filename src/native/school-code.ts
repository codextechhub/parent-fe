/**
 * The school a store app is for: its code, the left part of the school's
 * address (`meridian` for `meridian.xvs.codexng.com`).
 *
 * A browser reads the school off the address it was served from. The store app
 * has one address for every school, so the parent enters the code once and the
 * app keeps it. It is not a secret and lives in the phone's preferences. It is
 * read into memory before the app mounts (`loadSchoolCode`) so that
 * `currentSchoolSlug()` can stay synchronous.
 */

const KEY = "xvs.parent.school-code";

/** A school code as DNS and the API both accept it: lowercase letters, digits and hyphens. */
const CODE = /^[a-z0-9][a-z0-9-]*$/;

let current = "";

/**
 * A code as typed, made into one the API accepts, or "" when it cannot be one.
 *
 * Capitals and spaces around it are forgiven, and so is a whole address
 * pasted from the school's letter: only the school's own label is kept.
 */
export function normaliseSchoolCode(input: string): string {
  let text = (input || "").trim().toLowerCase();
  text = text.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0];
  const label = text.split(".")[0];
  return CODE.test(label) ? label : "";
}

/** The school the app is set to, or "" before one is chosen. */
export function nativeSchoolCode(): string {
  return current;
}

/** Reads the kept code into memory; call once before the app mounts. */
export async function loadSchoolCode(): Promise<string> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEY });
    current = normaliseSchoolCode(value ?? "");
  } catch {
    current = "";
  }
  return current;
}

/** Keeps `code` as the school the app is for. */
export async function saveSchoolCode(code: string): Promise<void> {
  const clean = normaliseSchoolCode(code);
  if (!clean) throw new Error("Not a school code.");
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key: KEY, value: clean });
  current = clean;
}
