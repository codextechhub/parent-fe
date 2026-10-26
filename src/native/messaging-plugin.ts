import { registerPlugin } from "@capacitor/core";
import type { FirebaseMessagingPlugin } from "@capacitor-firebase/messaging";

/**
 * The native side of `@capacitor-firebase/messaging`, reached by name.
 *
 * The package's own entry point also registers a web implementation, which
 * imports the Firebase web SDK. The store app never runs in a browser and the
 * web app never calls this, so the web implementation would only add the whole
 * SDK to both builds. Registering the plugin here gives the bridge the same
 * name the iOS and Android code answer to (`FirebaseMessaging`), without it.
 * Only the package's types are used.
 */
export const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>("FirebaseMessaging");
