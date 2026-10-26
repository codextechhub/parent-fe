/// <reference types="@capacitor-firebase/messaging" />

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The XVS Parent store app: the parent web app in a Capacitor shell.
 *
 * `webDir` is the native build (`npm run build:native`), kept apart from the
 * web app's `dist/`. The default schemes are kept on purpose: the WebView's
 * origin is `capacitor://localhost` on iOS and `https://localhost` on Android,
 * and those are the two origins the API accepts as the store app.
 */
const config: CapacitorConfig = {
  appId: "com.codexng.xvs.parent",
  appName: "XVS Parent",
  webDir: "dist-native",
  // The web view's colour before the page has painted, the app's page background.
  backgroundColor: "#F9FAFB",
  // The messaging plugin and Capacitor each pull in a Swift package; linking the plugin by
  // symlink avoids the package identity collision between them.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/messaging": { symlink: true },
        },
      },
    },
  },
  plugins: {
    // A notification that arrives while the app is open: the iPhone shows its banner and plays
    // its sound itself. Android shows nothing for an open app, so the app shows a toast
    // (`native-push.tsx`).
    FirebaseMessaging: {
      presentationOptions: ["alert", "sound"],
    },
    // The splash (the XVS crest) is taken down by the app once its first real
    // screen is drawn (`src/native/splash.ts`). Auto-hide is the safety net: if
    // the app never gets that far, the plugin removes the splash itself after
    // this long, so a failed start never leaves it up for good.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 8000,
      launchFadeOutDuration: 200,
      backgroundColor: "#F9FAFB",
      showSpinner: false,
    },
  },
};

export default config;
