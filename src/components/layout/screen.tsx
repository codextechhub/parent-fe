import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

/**
 * The large title a tab's screen opens on, as on an iPhone: a small line over
 * it ("3 unread", "JSS 3 Gold"), an action on the right, and anything that
 * belongs under it (chips, a switch). The app shell leaves the screen's name
 * out of its header until this has scrolled away (`LARGE_TITLE` there).
 * Styles are in `screen.css`, which the shell loads.
 */
export function ScreenTitle({
  title,
  eyebrow,
  eyebrowClassName,
  action,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  eyebrowClassName?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="screen-title">
        <div>
          {eyebrow && <p className={cn("screen-title-eyebrow", eyebrowClassName)}>{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {action}
      </div>
      {children && <div className="screen-title-below">{children}</div>}
    </div>
  );
}

/**
 * The top of a screen opened from another (`isDetailPath`): a round back
 * button, or with `backText` a pill that names where it goes ("My fees"), the
 * title and a line under it in the middle (or none), and an optional action
 * on the right. It stays at the top and turns frosted once the screen
 * scrolls under it. (The app shell opens every screen at its top.) A
 * `<header>`, so it never prints.
 */
export function DetailBar({ title, subtitle, back, backLabel, backText, action }: { title?: string; subtitle?: string; back: string; backLabel: string; backText?: string; action?: ReactNode }) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 4);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className={cn("detail-bar", backText && "has-pill", scrolled && "is-scrolled")}>
      {backText
        ? <Link to={back} className="detail-bar-pill" aria-label={backLabel}><ChevronLeft size={20} aria-hidden="true" />{backText}</Link>
        : <Link to={back} className="detail-bar-button" aria-label={backLabel}><ChevronLeft size={22} aria-hidden="true" /></Link>}
      <div className="detail-bar-title">
        {title && <h1>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action ? <div className="detail-bar-action">{action}</div> : <span aria-hidden="true" />}
    </header>
  );
}

/** The action bar at the foot of a screen opened from another, where the tab bar would be. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="bottom-bar-space" aria-hidden="true" />
      <div className="bottom-bar print-hide"><div>{children}</div></div>
    </>
  );
}
