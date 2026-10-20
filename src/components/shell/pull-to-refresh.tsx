import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { ALL_TAGS, baseApi } from "@/redux/services/base-api";

/** How far a pull has to travel, in px, before letting go reads everything again. */
const TRIGGER = 64;
/** The furthest the indicator follows the finger. */
const MAX = 96;

/**
 * Pull down from the top of a screen to read everything on it again.
 *
 * Touch only, and only when the page is already scrolled to the top, so it
 * never fights an ordinary scroll. The browser's own pull-to-reload is turned
 * off in `index.css` (`overscroll-behavior-y`), because reloading the page
 * would drop the parent's in-memory sign-in and the child showing for no
 * reason.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      distance.current = dy > 0 ? Math.min(MAX, dy * 0.5) : 0;
      setPull(distance.current);
    };
    const up = async () => {
      const went = distance.current;
      start.current = null;
      distance.current = 0;
      setPull(0);
      if (went < TRIGGER) return;
      setBusy(true);
      dispatch(baseApi.util.invalidateTags([...ALL_TAGS]));
      window.setTimeout(() => setBusy(false), 600);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dispatch]);

  const shown = busy ? TRIGGER * 0.6 : pull;
  return (
    <div className="relative min-w-0 flex-1">
      <div
        aria-hidden={!busy}
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{ height: shown, opacity: shown ? 1 : 0 }}
      >
        <RefreshCw
          className={cn("mt-3 size-5 text-primary", busy && "animate-spin")}
          style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </div>
      <div style={{ transform: shown ? `translateY(${shown}px)` : undefined }} className="transition-transform">
        {children}
      </div>
    </div>
  );
}
