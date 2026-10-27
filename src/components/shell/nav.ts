import {
  Award, Bell, CalendarDays, CheckCircle2, Home, Inbox, MessageSquare, User, Wallet, type LucideIcon,
} from "lucide-react";

/** One destination in the parent app's navigation. */
export type NavItem = {
  key: "home" | "timetable" | "results" | "attendance" | "inbox" | "notices" | "messages" | "fees" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /**
   * Where the parent reaches it: a tab on the bar, the Inbox button (the Inbox
   * itself and the notice or conversation opened from it), or neither
   * (Timetable opens from a child's card on Home, Profile from the switcher
   * behind the child's avatar at the top of every screen).
   */
  place: "bar" | "inbox" | "off";
  /** Whether a per-child URL segment (`?child=`) travels with this link. */
  perChild?: boolean;
};

/**
 * The parent app's screens, in the design's order.
 *
 * The bar is the redesign's split bar, the same one the student app uses:
 * Home, Results, Attendance and Fees as tabs, and beside them an Inbox button
 * for the school's notices and the parent's messages in one list.
 *
 * `perChild` marks the routes that need to know whose child is being read.
 * The child switcher attaches `?child=` to a link that carries it, and drops
 * it from one that does not (Fees, the Inbox, Profile).
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, place: "bar" },
  { key: "results", label: "Results", path: "/results", icon: Award, place: "bar", perChild: true },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: CheckCircle2, place: "bar", perChild: true },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, place: "bar" },
  { key: "timetable", label: "Timetable", path: "/timetable", icon: CalendarDays, place: "off", perChild: true },
  { key: "inbox", label: "Inbox", path: "/inbox", icon: Inbox, place: "inbox" },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell, place: "inbox" },
  { key: "messages", label: "Messages", path: "/messages", icon: MessageSquare, place: "inbox" },
  { key: "profile", label: "Profile", path: "/profile", icon: User, place: "off" },
];

/** The tabs on the bar, in order. */
export const TABS = NAV.filter((item) => item.place === "bar");

/** The screens the Inbox button stands for: the Inbox, and a notice or conversation opened from it. */
export const INBOX = NAV.filter((item) => item.place === "inbox");

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) =>
      item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
}

/**
 * Whether the path is a screen opened from another, drawn with its own back
 * bar at the top (a notice, a new message). The shell's header and tab bar
 * step aside for it at every size, as an iPhone pushes a screen over its
 * tabs. More screens join as the redesign reaches them.
 */
export function isDetailPath(pathname: string): boolean {
  return /^\/notices\/[^/]+\/?$/.test(pathname) || /^\/messages\/new\/?$/.test(pathname);
}

/**
 * Whether a path is an open message conversation (`/messages/41`).
 *
 * An open conversation is a screen that owns its own scrolling: the shell
 * fixes its height to the visible screen, turns pull-to-refresh off and takes
 * the header and the tab bar away at every size, so the conversation's own
 * header, with the way back to the Inbox, is the top of the screen.
 * `/messages/new` is an ordinary form and is not one.
 */
export function isConversationPath(pathname: string): boolean {
  return /^\/messages\/\d+\/?$/.test(pathname);
}
