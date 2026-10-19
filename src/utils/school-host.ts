/**
 * Which school this page is for, read off the address it is served from.
 *
 * The app is served per school: the page at bright-star.xvs.codexng.com is
 * Bright Star's, and the slug in front of the base domain is what identifies
 * it. Wildcard DNS and a wildcard certificate cover `*.xvs.codexng.com`, so any
 * school's address reaches this same bundle and the bundle has to work out on
 * its own which school it is showing.
 *
 * It matters more than a label. One email address can now be an account at
 * several schools with no connection between them, so a sign-in has to name the
 * tenant it is addressed to or the backend cannot tell those accounts apart.
 * This module is where that name comes from.
 *
 * THE TRAP THIS EXISTS TO AVOID: `hostname.split(".")[0]` returns "xvs" on the
 * bare domain, which is not a school and must never be sent as one. Bare
 * xvs.codexng.com is the XVS product site rather than the app, and deliberately
 * not a school finder - listing the schools that use the product would disclose
 * Codex's customers to each other. "No school" is therefore a real answer this
 * function returns, not a failure to handle.
 */

/** The domain the app is served under. Overridable so staging can differ. */
const BASE_DOMAIN = (import.meta.env.VITE_APP_BASE_DOMAIN || "xvs.codexng.com")
  .trim()
  .toLowerCase();

/**
 * A school slug as DNS and the backend both accept it: lowercase letters,
 * digits and hyphens. Underscores are excluded because `tenant_slug_validator`
 * refuses them, which is also what keeps the backend's `__none__` sentinel from
 * ever colliding with a real school.
 */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Hosts that carry no school even though the wildcard resolves them.
 *
 * Only `www` is listed, and only because it is the one label a person types by
 * habit. The backend owns the full reserved list (67 names) and refuses those
 * slugs itself; duplicating it here would be two lists to keep in step, and the
 * second one would drift.
 */
const NOT_A_SCHOOL = new Set(["www"]);

/**
 * The school slug carried by a hostname, or "" when it carries none.
 *
 * Pure and explicit about its input so it can be tested without a browser;
 * `currentSchoolSlug()` below is what application code calls.
 */
export function schoolSlugFromHostname(
  hostname: string,
  baseDomain: string = BASE_DOMAIN,
): string {
  // A trailing dot is a legal fully-qualified hostname and would otherwise fail
  // every comparison below.
  const host = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  const base = (baseDomain || "").trim().toLowerCase().replace(/\.$/, "");
  if (!host || !base) return "";

  // The bare domain is the product site. This is the case the split-on-dot
  // shortcut gets wrong, so it is answered before anything else.
  if (host === base) return "";

  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return "";

  const prefix = host.slice(0, -suffix.length);

  // Exactly one label. `a.b.xvs.codexng.com` is not Bright Star with something
  // in front of it - it is an address nobody issued, and guessing which label
  // to believe is how a page ends up asserting the wrong tenant.
  if (prefix.includes(".")) return "";
  if (NOT_A_SCHOOL.has(prefix)) return "";
  if (!SLUG.test(prefix)) return "";

  return prefix;
}

/**
 * The school this page is for, or "" when the address names none.
 *
 * In development there is no subdomain to read, so `VITE_DEV_SCHOOL_SLUG` fills
 * in - but only when the hostname genuinely yielded nothing, and only in a dev
 * build. A production bundle ignores it entirely, so it can never be the reason
 * a live page asserts a tenant. `bright-star.localhost` also works, and is the
 * closer rehearsal of production.
 */
export function currentSchoolSlug(hostname: string = window.location.hostname): string {
  const fromHost = schoolSlugFromHostname(hostname)
    // Local development: browsers resolve *.localhost to the loopback address,
    // so this is a real subdomain read rather than a special case.
    || schoolSlugFromHostname(hostname, "localhost");
  if (fromHost) return fromHost;

  if (import.meta.env.DEV) {
    const override = (import.meta.env.VITE_DEV_SCHOOL_SLUG || "").trim().toLowerCase();
    if (SLUG.test(override)) return override;
  }
  return "";
}
