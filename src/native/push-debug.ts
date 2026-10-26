import { deviceToken } from "./push-device";
import { isDebugBuild } from "./platform";

/**
 * In a debug build of the store app, writes to the device log that Firebase
 * gave this install a token (and the token, for pasting into Firebase's test
 * send). A release build writes nothing.
 */
export async function logDebugToken(): Promise<void> {
  if (!isDebugBuild()) return;
  try {
    console.debug(`[push] Firebase token obtained: ${await deviceToken()}`);
  } catch (error) {
    console.debug("[push] Firebase gave no token", error);
  }
}
