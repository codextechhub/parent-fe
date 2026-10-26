import { itemFor } from "@/components/shell/nav";

/**
 * Where a tapped notification leads.
 *
 * The API attaches `url` (a path on the school's host, under `/parent`, such
 * as `/parent/notices/41`) and, for a notification about one child, `child`,
 * that child's id (a phone push carries every value as text). The store app's
 * router has no `/parent` prefix, so the prefix comes off. A notification
 * about a child opens a per-child screen (Results, Attendance, Timetable) on
 * that child, with `?child=`, when the address does not name one itself. A
 * `url` that is not a path inside the parent app opens the home screen
 * instead: a notification must never send the app to another site or another
 * part of the school's website.
 */
export type TapTarget = { path: string };

const PREFIX = "/parent";

export function tapTarget(data: Record<string, unknown>): TapTarget {
  const url = typeof data.url === "string" ? data.url.trim() : "";
  return { path: withChild(appPath(url), childId(data.child)) };
}

/** The child a notification is about, or null. Accepts the number or the text a phone push carries. */
function childId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** `path` with `?child=` added when it is a per-child screen that names no child. */
function withChild(path: string, child: number | null): string {
  if (child === null) return path;
  const [before, hash = ""] = path.split("#");
  const [pathname, query = ""] = before.split("?");
  if (!itemFor(pathname)?.perChild) return path;
  const params = new URLSearchParams(query);
  if (params.has("child")) return path;
  params.set("child", String(child));
  return `${pathname}?${params}${hash ? `#${hash}` : ""}`;
}

/** `/parent/results?x=1` as the router's own path, `/results?x=1`; "/" for anything else. */
export function appPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return "/";
  if (url !== PREFIX && !url.startsWith(`${PREFIX}/`) && !url.startsWith(`${PREFIX}?`) && !url.startsWith(`${PREFIX}#`)) {
    return "/";
  }
  const rest = url.slice(PREFIX.length);
  if (!rest || rest.startsWith("?") || rest.startsWith("#")) return `/${rest}`;
  return rest;
}
