import {
  Award, Bell, CalendarDays, CheckCircle2, Home, MessageSquare, User, Wallet, type LucideIcon,
} from "lucide-react";

/** One destination in the parent app's navigation. */
export type NavItem = {
  key: "home" | "timetable" | "results" | "attendance" | "notices" | "messages" | "fees" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /** Kept on the tab bar when there are too many screens for it. */
  onBar?: boolean;
  /** Whether a per-child URL segment (`?child=`) travels with this link. */
  perChild?: boolean;
};

/**
 * The parent app's destinations: eight. Four sit on the tab bar and the rest
 * behind More, in the design's own order. Home, Results, Fees and Notices
 * keep the bar because they are the ones a parent opens most; the owner's
 * choice of those four stands. Messages is the newest and goes under More
 * with Timetable, Attendance and Profile, so its unread count is carried on
 * the More tab and on its own row in the sheet rather than hidden there.
 *
 * `perChild` marks the routes that need to know whose child is being read.
 * The child switcher attaches `?child=` to a link that carries it, and drops
 * it from one that does not (Fees, Notices, Messages, Profile).
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, onBar: true },
  { key: "timetable", label: "Timetable", path: "/timetable", icon: CalendarDays, perChild: true },
  { key: "results", label: "Results", path: "/results", icon: Award, onBar: true, perChild: true },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: CheckCircle2, perChild: true },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, onBar: true },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell, onBar: true },
  { key: "messages", label: "Messages", path: "/messages", icon: MessageSquare },
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

/**
 * Whether a path is an open message conversation (`/messages/41`).
 *
 * An open conversation is a screen that owns its own scrolling: the shell
 * fixes its height to the visible screen, turns pull-to-refresh off and, on a
 * phone, takes the tab bar away. `/messages/new` is an ordinary form and is
 * not one.
 */
export function isConversationPath(pathname: string): boolean {
  return /^\/messages\/\d+\/?$/.test(pathname);
}
