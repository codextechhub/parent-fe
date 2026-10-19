/**
 * Public branding URLs for the school named by the current address.
 *
 * The school app and API have different origins, so these URLs must be
 * absolute. The crest on the authenticated payload is bound to its reader;
 * before sign-in, a known slug supplies the public crest and exact name.
 */
function publicSchoolBrandUrl(slug: string, resource: "logo" | "name"): string {
  const clean = (slug || "").trim().toLowerCase();
  if (!clean) return "";
  const base = String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/i/public/schools/${encodeURIComponent(clean)}/${resource}/`;
}

/** The public crest URL for a school slug, or "" without a school address. */
export function schoolLogoUrl(slug: string): string {
  return publicSchoolBrandUrl(slug, "logo");
}

/** The public display-name URL for the school named by this address. */
export function schoolNameUrl(slug: string): string {
  return publicSchoolBrandUrl(slug, "name");
}
