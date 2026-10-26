import { useEffect } from "react";
import { useLocation } from "react-router";

import { useAppSelector } from "@/redux/hooks";

import { hideSplash } from "./splash";

/**
 * Hides the splash once the first real screen has been painted.
 *
 * With `ready` set the screen is already the first real one (the school
 * choice, which needs no session). Otherwise the app waits until the sign-in
 * is on screen, or `me/` has answered (the parent's home, or the sign-in the
 * guard sends them to): from then on it shows a real screen, never the loading
 * mark. The hide waits two animation frames so the screen is on the page
 * before the splash fades.
 */
export function SplashGate({ ready = false }: { ready?: boolean }) {
  const checked = useAppSelector((s) => s.auth.checked);
  const onSignIn = useLocation().pathname === "/sign-in";
  const settled = ready || checked || onSignIn;
  useEffect(() => {
    if (!settled) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => void hideSplash());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [settled]);
  return null;
}
