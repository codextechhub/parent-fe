import { normaliseSchoolCode } from "./school-code";

/**
 * Links that open the store app.
 *
 * The school's website claims `/parent/*` on every school address for this
 * app (Android's `assetlinks.json`, iPhone's
 * `apple-app-site-association`), so a link a school sends, such as
 * `https://meridian.xvs.codexng.com/parent/fees`, opens the app on the phone.
 * The school is the address's left label, and the app's own path is what
 * follows `/parent`, since the store app's router starts at `/`.
 */

/** The domains schools' addresses are under: production and staging. */
const SCHOOL_DOMAINS = ["xvs.codexng.com", "xvs-staging.codexng.com"];

/** The path the website gives the parent app; the store app's router has no such prefix. */
const WEB_PREFIX = "/parent";

/** What to do with an opened link. */
export type LinkDecision =
  | { kind: "ignore" }
  | { kind: "go"; path: string }
  | { kind: "confirm"; code: string; path: string; switching: boolean };

/**
 * The school code and the app path a link names, or null when it is not a link
 * to a school's parent app.
 *
 * The address must be `https`, exactly one label in front of a school domain
 * (`a.b.xvs.codexng.com` and the bare domain name no school), and under
 * `/parent`.
 */
export function parseSchoolLink(link: string): { code: string; path: string } | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const domain = SCHOOL_DOMAINS.find((d) => host.endsWith(`.${d}`));
  if (!domain) return null;
  const label = host.slice(0, -(domain.length + 1));
  if (label.includes(".") || label === "www") return null;
  const code = normaliseSchoolCode(label);
  if (!code || code !== label) return null;
  if (url.pathname !== WEB_PREFIX && !url.pathname.startsWith(`${WEB_PREFIX}/`)) return null;
  const rest = url.pathname.slice(WEB_PREFIX.length) || "/";
  return { code, path: `${rest}${url.search}${url.hash}` };
}

/**
 * What the app does with an opened link, given the school it is set to ("" before one is chosen).
 *
 * A link for the school the app is already set to goes straight to the screen.
 * A link for another school, or for any school when none is chosen yet, asks
 * first: switching changes whose children the app shows, and a link must not do
 * that on its own.
 */
export function decideLink(link: string, currentCode: string): LinkDecision {
  const parsed = parseSchoolLink(link);
  if (!parsed) return { kind: "ignore" };
  if (parsed.code === currentCode) return { kind: "go", path: parsed.path };
  return { kind: "confirm", code: parsed.code, path: parsed.path, switching: currentCode !== "" };
}
