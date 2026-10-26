import { Capacitor } from "@capacitor/core";

/**
 * Whether this page is running inside the store app (the Capacitor shell on an
 * iPhone or an Android phone) rather than in a browser.
 *
 * Every native-only branch in the app asks here and nowhere else, so the web
 * app is the same app with this answering false: no native code runs, and none
 * of the native plugins is loaded.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * The router's basename.
 *
 * The web app lives under `/parent/` on a school's own address, beside
 * school-fe. The store app is served from its own origin (`capacitor://localhost`
 * on iOS, `https://localhost` on Android) and owns its root.
 */
export function routerBasename(): string {
  return isNativeApp() ? "/" : "/parent";
}

/**
 * Which phone the store app is on, or "" in a browser.
 *
 * The version check asks the API about the store this build is published in.
 */
export function nativePlatform(): "ios" | "android" | "" {
  if (!isNativeApp()) return "";
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "";
}

/**
 * Whether this is a debug build of the store app, which is what lets it log
 * what a release build keeps quiet (a Firebase token, for one).
 *
 * Capacitor sets the flag from the native project: a debuggable Android
 * build, an iPhone build with `CAPACITOR_DEBUG` on.
 */
export function isDebugBuild(): boolean {
  return isNativeApp() && (Capacitor as unknown as { DEBUG?: boolean }).DEBUG === true;
}
