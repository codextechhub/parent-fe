import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Dialog } from "radix-ui";
import { NavLink, Outlet, useLocation } from "react-router";

import { SchoolMark } from "@/components/school-mark";
import {
  ChildSwitcher, CHILD_PARAM, useActiveChild, useFollowAddressedChild,
} from "@/components/session/child-switcher";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { reachedSchool, wentOffline } from "@/redux/features/connectivity-slice";
import { useUnreadMessagesQuery } from "@/redux/services/messages-api";
import { useNoticesQuery } from "@/redux/services/portal-api";

import { isConversationPath, itemFor, NAV, splitTabs, type NavItem } from "./nav";
import { OfflineBar } from "./offline-bar";
import { PullToRefresh } from "./pull-to-refresh";
import { useNarrowScreen, useVisibleViewport } from "./viewport";
import "./app-shell.css";

/** How often the unread message count is read again while the app is in view, in ms. */
const UNREAD_POLL_MS = 60_000;

/**
 * The frame every signed-in parent screen sits in.
 *
 * The student app's frame: a floating tab bar at the bottom at every size,
 * and a header carrying the school's crest, the screen title and the child
 * switcher. The header is clear over the page's own tinted background, so
 * the two read as one surface, and turns frosted once the page scrolls under
 * it. The offline bar sits under the header whenever the browser reports no
 * connection, and a pull down from the top of a screen reads everything on
 * it again. The unread message count is read every minute, on regaining
 * focus and on reconnecting; it is the badge on Messages.
 *
 * An open message conversation owns its scrolling (`isConversationPath`), so
 * the frame stops scrolling with the page: it is fixed to the visible screen
 * (`--vv-height` follows the phone keyboard, see `useVisibleViewport`), the
 * pull-to-refresh is off so a pull at the top of the older messages cannot
 * start a refresh, and below 900px the tab bar is taken away, as a chat app
 * does, to give the messages and the box their room, and the shell's own
 * header goes with it, so the conversation's header and its back arrow are the
 * top of the screen (the page keeps clear of the top safe-area inset through
 * `--screen-inset-top`, which the offline bar takes over while it shows, since
 * it then sits first). Back returns to the list, the header and the tab bar.
 * From 900px the conversation sits beside the list and both the header and
 * the tab bar stay, with room reserved under the panes.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const fixed = isConversationPath(pathname);
  const narrow = useNarrowScreen();
  // A phone's open conversation is the whole screen: its own header, with the way back, is the top.
  const bareScreen = fixed && narrow;
  const offline = useAppSelector((s) => s.connectivity.offline);
  const frame = useRef<HTMLDivElement>(null);
  useVisibleViewport(frame, fixed);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
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
    : current?.key === "home"
      ? "Home"
      : current?.key === "timetable" ? "Timetable"
      : current?.key === "results" ? "Results"
      : current?.key === "attendance" ? "Attendance"
      : current?.key === "fees" ? "Fees"
      : current?.key === "notices" ? "Notices"
      : current?.key === "messages" ? "Messages"
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
        !fixed && "min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]",
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
            <p className="truncate text-base font-semibold text-foreground">{screenTitle}</p>
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

/** One tab's look. */
const TAB =
  "relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors";

/** The frosted pill floating above the bottom edge. */
function TabBar({ badges }: { badges: Partial<Record<NavItem["key"], number>> }) {
  const { tabs, more } = splitTabs(NAV);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const focus = useActiveChild();
  const linkFor = (item: NavItem) =>
    item.perChild && focus ? `${item.path}?${CHILD_PARAM}=${focus.id}` : item.path;
  const moreShowing = more.some((item) => item.key === itemFor(pathname)?.key);
  const activeIndex = moreShowing
    ? tabs.length
    : Math.max(0, tabs.findIndex((item) => item.key === itemFor(pathname)?.key));
  const tabCount = tabs.length + (more.length > 0 ? 1 : 0);
  const moreCount = more.reduce((total, item) => total + (badges[item.key] ?? 0), 0);
  return (
    <nav
      aria-label="Screens"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto relative flex w-full max-w-md gap-1 rounded-full border border-white/70 bg-white/70 p-1.5 shadow-[0_10px_30px_-8px_rgba(17,24,39,0.25)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `calc((100% - 12px - ${(tabCount - 1) * 4}px) / ${tabCount})`,
            transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))`,
          }}
        />
        {tabs.map((item) => {
          const Icon = item.icon;
          const count = badges[item.key];
          return (
            <NavLink
              key={item.key}
              to={linkFor(item)}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  TAB,
                  isActive
                    ? "font-medium text-primary"
                    : "text-gray-05 hover:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon className="size-5" />
                {!!count && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 font-semibold text-primary-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
        {more.length > 0 && (
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger
              className={cn(
                TAB,
                moreShowing ? "font-medium text-primary" : "text-gray-05 hover:text-foreground",
              )}
            >
              <span className="relative">
                <MoreHorizontal className="size-5" />
                {moreCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 font-semibold text-primary-foreground"
                    aria-label={`${moreCount} unread under More`}
                  >
                    {moreCount > 9 ? "9+" : moreCount}
                  </span>
                )}
              </span>
              More
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background p-3 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:inset-x-auto sm:bottom-24 sm:left-1/2 sm:w-96 sm:-translate-x-1/2 sm:rounded-2xl"
              >
                <Dialog.Title className="px-3 pb-2 text-xs font-medium text-gray-05">
                  More
                </Dialog.Title>
                {more.map((item) => {
                  const Icon = item.icon;
                  const count = badges[item.key];
                  return (
                    <div key={item.key} onClick={() => setMoreOpen(false)}>
                      <NavLink
                        to={linkFor(item)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-accent",
                          )
                        }
                      >
                        <Icon className="size-4.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {!!count && (
                          <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-primary-foreground">
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </NavLink>
                    </div>
                  );
                })}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </nav>
  );
}
