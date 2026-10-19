import { Award, Bell, Home, User, Wallet, type LucideIcon } from "lucide-react";

/** One destination in the parent app's navigation. */
export type NavItem = {
  key: "home" | "results" | "fees" | "notices" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /** Kept on the tab bar when there are too many screens for it. */
  onBar?: boolean;
  /** Whether a per-child URL segment (`?child=`) travels with this link. */
  perChild?: boolean;
};

/**
 * Phase 2 nav: five destinations, no More sheet needed. Phase 4 adds the
 * per-child screens (Timetable, Attendance, Assignments) and the More item
 * splits in.
 *
 * `perChild` marks the routes that need to know whose child is being read.
 * The child switcher attaches `?child=` to a link that carries it, and drops
 * it from one that does not (Fees, Notices, Profile).
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, onBar: true },
  { key: "results", label: "Results", path: "/results", icon: Award, onBar: true, perChild: true },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, onBar: true },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell, onBar: true },
  { key: "profile", label: "Profile", path: "/profile", icon: User, onBar: true },
];

/** How many destinations the tab bar holds before some go under More. */
export const TAB_SLOTS = 5;

/**
 * The tab bar's tabs and what goes under More.
 *
 * Up to five all fit as tabs; beyond that the ones flagged `onBar` take the
 * first four slots and More takes the fifth.
 */
export function splitTabs(items: NavItem[]): { tabs: NavItem[]; more: NavItem[] } {
  if (items.length <= TAB_SLOTS) return { tabs: items, more: [] };
  const tabs = items.filter((item) => item.onBar).slice(0, TAB_SLOTS - 1);
  return { tabs, more: items.filter((item) => !tabs.includes(item)) };
}

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) =>
      item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
}
