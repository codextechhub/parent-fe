import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router";

import { SchoolMark } from "@/components/school-mark";
import {
  ChildSwitcher, CHILD_PARAM, useActiveChild, useFollowAddressedChild,
} from "@/components/session/child-switcher";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { reachedSchool, wentOffline } from "@/redux/features/connectivity-slice";
import { useUnreadMessagesQuery } from "@/redux/services/messages-api";
import { useNoticesQuery } from "@/redux/services/portal-api";

import { INBOX, isConversationPath, isDetailPath, itemFor, TABS, type NavItem } from "./nav";
import { OfflineBar } from "./offline-bar";
import { PullToRefresh } from "./pull-to-refresh";
import { useVisibleViewport } from "./viewport";
import "@/components/layout/screen.css";
import "./app-shell.css";

/** How often the unread message count is read again while the app is in view, in ms. */
const UNREAD_POLL_MS = 60_000;

/**
 * The screens that open on the redesign's large title. The header leaves
 * their name out until the large title has scrolled away under it, as on an
 * iPhone, so the name is never on screen twice.
 */
const LARGE_TITLE: ReadonlySet<NavItem["key"]> = new Set(["inbox"]);

/** How far down, in px, a large title has gone under the header. */
const LARGE_TITLE_PAST = 56;

/**
 * The frame every signed-in parent screen sits in.
 *
 * At every size the screens sit over the redesign's split bar, the student
 * app's: a frosted pill of four tabs (Home, Results, Attendance, Fees) and,
 * beside it, a round Inbox button for the school's notices and the parent's
 * messages in one list. The header carries the school's crest, the screen
 * title and the child switcher. It is clear over the page's own tinted
 * background, so the two read as one surface, and turns frosted once the page
 * scrolls under it. The offline bar sits under the header whenever the
 * browser reports no connection, and a pull down from the top of a screen
 * reads everything on it again. The unread message count is read every
 * minute, on regaining focus and on reconnecting.
 *
 * A screen opened from another (`isDetailPath`: a notice, a new message)
 * draws its own back bar, so the header and the tab bar step aside for it at
 * every size.
 *
 * An open message conversation owns its scrolling (`isConversationPath`), so
 * the frame stops scrolling with the page: it is fixed to the visible screen
 * (`--vv-height` follows the phone keyboard, see `useVisibleViewport`), the
 * pull-to-refresh is off so a pull at the top of the older messages cannot
 * start a refresh, and the header and the tab bar step aside at every size,
 * as in a messaging app: the conversation's header, with its way back to the
 * Inbox, is the top of the screen (the page keeps clear of the top safe-area
 * inset through `--screen-inset-top`, which the offline bar takes over while
 * it shows, since it then sits first).
 */
export function AppShell() {
  const { pathname } = useLocation();
  useTopOfNewScreen(pathname);
  const fixed = isConversationPath(pathname);
  const detail = isDetailPath(pathname);
  // A screen with bars of its own: its header, with the way back, is the top.
  const bareScreen = fixed || detail;
  const offline = useAppSelector((s) => s.connectivity.offline);
  const frame = useRef<HTMLDivElement>(null);
  useVisibleViewport(frame, fixed);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const [titlePast, setTitlePast] = useState(() => window.scrollY > LARGE_TITLE_PAST);
  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 8);
      setTitlePast(window.scrollY > LARGE_TITLE_PAST);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const me = useAppSelector((s) => s.auth.me);
  const { data: firstPage } = useNoticesQuery(1, { skip: !me });
  const unreadNotices = firstPage?.unreadCount ?? 0;
  const { data: unreadMessages = 0 } = useUnreadMessagesQuery(undefined, {
    skip: !me,
    pollingInterval: UNREAD_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const dispatch = useAppDispatch();
  useEffect(() => {
    const down = () => dispatch(wentOffline());
    const up = () => dispatch(reachedSchool());
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [dispatch]);
  const current = itemFor(pathname);
  const screenTitle = pathname.startsWith("/results/card/")
    ? "Report card"
    : pathname.startsWith("/fees/invoices/") ? "Invoice"
    : pathname.startsWith("/fees/receipts/") ? "Receipt"
    : pathname.startsWith("/fees/pay-all") ? "Pay all"
    : pathname.startsWith("/fees/pay/") ? "Pay"
    : pathname === "/fees/paid" ? "Payment status"
    : pathname === "/profile/delete-account" ? "Delete my account"
    : current?.key === "profile" ? "My profile"
    : current?.label ?? "";

  useFollowAddressedChild();
  // Names the crest to a screen reader: the school, and the showing child's branch where there are several.
  const active = useActiveChild();
  const where = me?.show_branch && active?.branch
    ? `${me.school.name} · ${active.branch.name}`
    : me?.school.name ?? "";

  return (
    <div
      ref={frame}
      className={cn(
        "app-shell app-shell--design flex min-w-0 flex-col bg-background",
        fixed && "app-shell--fixed",
        fixed && offline && "app-shell--offline",
        !fixed && "min-h-dvh",
        !bareScreen && "pb-[calc(6rem+env(safe-area-inset-bottom))]",
      )}
    >
      {!bareScreen && (
        <header
          className={cn(
            "sticky top-0 z-30 flex min-h-[58px] shrink-0 min-w-0 items-center gap-3 border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 transition-[background-color,backdrop-filter,border-color] duration-200 sm:min-h-[66px] lg:px-6",
            scrolled
              ? "border-[#dbe0eb] bg-[#f5f7fc]/70 backdrop-blur-xl backdrop-saturate-150"
              : "border-transparent bg-transparent",
          )}
        >
          <SchoolMark
            logo={me?.school.logo_url || null}
            size={34}
            animate={false}
            alt={where}
            className="max-h-7 sm:max-h-[34px]"
          />
          <div className="min-w-0 flex-1">
            <p
              className="app-shell-title truncate text-base font-semibold text-foreground"
              data-hidden={(current && LARGE_TITLE.has(current.key) && !titlePast) || undefined}
            >
              {screenTitle}
            </p>
          </div>
          <ChildSwitcher />
        </header>
      )}
      <OfflineBar clearTop={bareScreen} />
      <PullToRefresh fillHeight={fixed}>
        <Outlet />
      </PullToRefresh>
      {!bareScreen && <TabBar badges={{ notices: unreadNotices, messages: unreadMessages }} />}
    </div>
  );
}

/**
 * Opens each screen at its top. The screens scroll the window, which keeps
 * its place across a change of address, so without this Results opened from
 * halfway down Home would open halfway down. Back and Forward leave the
 * scroll where the browser puts it, and a change of the query alone (the
 * Inbox's filter, the child showing) is the same screen, so neither moves.
 * It runs before the new screen is painted, so the old position never shows.
 */
function useTopOfNewScreen(pathname: string) {
  const navigation = useNavigationType();
  const shown = useRef(pathname);
  useLayoutEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    if (navigation !== "POP") window.scrollTo(0, 0);
  }, [pathname, navigation]);
}

/** A count on the Inbox button, capped so it stays a dot's size. */
function Count({ value, className }: { value?: number; className: string }) {
  if (!value) return null;
  return <span className={className}>{value > 9 ? "9+" : value}</span>;
}

/**
 * The app's tab bar, at every size: the design's split bar. A frosted pill
 * floats above the bottom edge with Home, Results, Attendance and Fees, the
 * screen showing tinted inside it, and beside it a round Inbox button that
 * opens the Inbox, one list of notices and messages. The Inbox button carries
 * both unread counts so nothing new is hidden behind it, and turns blue while
 * the Inbox, or a notice or conversation, is open. A per-child tab keeps the
 * child showing (`?child=`). It clears the home indicator on phones that have
 * one, and the page scrolls on underneath. `app-shell.css` holds its look.
 */
function TabBar({ badges }: { badges: Partial<Record<NavItem["key"], number>> }) {
  const { pathname } = useLocation();
  const focus = useActiveChild();
  const linkFor = (item: NavItem) =>
    item.perChild && focus ? `${item.path}?${CHILD_PARAM}=${focus.id}` : item.path;
  const inboxShowing = INBOX.some((item) => item.key === itemFor(pathname)?.key);
  const inboxCount = INBOX.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);
  // The tinted pill slides to the tab showing. On a screen that is no tab (the
  // Inbox, Timetable, Profile) it fades where it was, and slides on from there.
  const index = TABS.findIndex((item) => item.key === itemFor(pathname)?.key);
  const [lastIndex, setLastIndex] = useState(Math.max(0, index));
  if (index >= 0 && index !== lastIndex) setLastIndex(index);
  const at = index >= 0 ? index : lastIndex;
  return (
    <nav aria-label="Screens" className="app-shell-tabs">
      <div className="tab-bar">
        <span
          className="tab-bar-pill"
          data-hidden={index < 0 || undefined}
          style={{ width: `calc((100% - 12px - ${(TABS.length - 1) * 2}px) / ${TABS.length})`, transform: `translateX(calc(${at * 100}% + ${at * 2}px))` }}
          aria-hidden="true"
        />
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.key} to={linkFor(item)} end={item.path === "/"} className="tab-bar-tab">
              <Icon size={22} aria-hidden="true" />
              <span className="tab-bar-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
      <Link
        to="/inbox"
        className="tab-bar-inbox"
        data-showing={inboxShowing || undefined}
        aria-current={inboxShowing ? "page" : undefined}
        aria-label={inboxCount ? `Inbox, ${inboxCount} unread` : "Inbox"}
      >
        <Inbox size={23} aria-hidden="true" />
        <Count value={inboxCount} className="tab-bar-inbox-count" />
      </Link>
    </nav>
  );
}
