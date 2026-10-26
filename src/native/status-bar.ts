import { isNativeApp } from "./platform";

/** Which colour the system's clock, signal and battery are drawn in. */
export type StatusBarText = "light" | "dark";

/**
 * Sets the status bar's text colour in the store app.
 *
 * The app draws under the status bar, so the text must match whatever the
 * screen has at its top: "light" over a dark screen (the sign-in's blue
 * header), "dark" over a light one. It is always set, never left to the
 * phone's own light or dark mode, because the app's screens do not follow
 * that mode and white text on a white screen would vanish. A phone that
 * refuses is left as it is.
 */
export async function setStatusBarText(text: StatusBarText): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Capacitor names the style for the background: `Dark` is light text for a dark screen.
    await StatusBar.setStyle({ style: text === "light" ? Style.Dark : Style.Light });
  } catch {
    // The status bar keeps the colour it had.
  }
}

/** The text colour a screen needs at its top. The sign-in opens on a dark blue header; every other screen is light. */
export function statusBarTextFor(pathname: string): StatusBarText {
  return pathname === "/sign-in" ? "light" : "dark";
}
