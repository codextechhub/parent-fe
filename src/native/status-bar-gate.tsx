import { useEffect } from "react";
import { useLocation } from "react-router";

import { setStatusBarText, statusBarTextFor } from "./status-bar";

/**
 * Keeps the status bar's text readable on the screen showing, in the store app.
 *
 * Over the sign-in's dark blue header the text is light, and a strip of the
 * same blue is held under the status bar so that it stays readable when the
 * white sign-in card scrolls up beneath it. Every other screen is light and
 * gets dark text. Renders only that strip.
 */
export function StatusBarGate() {
  const { pathname } = useLocation();
  const text = statusBarTextFor(pathname);
  useEffect(() => {
    void setStatusBarText(text);
  }, [text]);
  return text === "light" ? <div className="status-bar-backdrop" aria-hidden="true" /> : null;
}
