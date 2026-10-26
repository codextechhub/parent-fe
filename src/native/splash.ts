import { isNativeApp } from "./platform";

/**
 * Takes down the store app's splash screen.
 *
 * The splash (the XVS crest) stays up from launch until the app has drawn its
 * first real screen: the school choice, the sign-in or the parent's home. The
 * app calls this once that screen is on the page. If the app never gets that
 * far, the plugin removes the splash itself after the safety timeout set in
 * `capacitor.config.ts`, so a failed start never leaves it up for good.
 */
export async function hideSplash(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    // The plugin's own timeout takes it down.
  }
}
