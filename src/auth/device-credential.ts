import { deleteCredential, getCredential, putCredential } from "@/native/credentials";
import { isNativeApp } from "@/native/platform";

import { authPost } from "./api";

/**
 * Signing the parent out of this device, in a browser and in the store app.
 *
 * A browser proves a parent with their HttpOnly cookie, so the call carries
 * only the account. The store app has no cookie: it sends the credential it
 * kept in the phone's secure storage (`native/credentials`) in the body, and
 * forgets it afterwards. The API answers 200 either way, including for a
 * credential it no longer knows.
 */
export async function deviceSignOut(account: string) {
  if (!isNativeApp()) return authPost("/user/auth/device/sign-out/", { account });
  let refresh = "";
  try {
    refresh = (await getCredential(account)) ?? "";
  } catch {
    // Unreadable: the API is told which account, and the session ends on its own clock.
  }
  const result = await authPost("/user/auth/device/sign-out/", { account, refresh });
  await deleteCredential(account);
  return result;
}

/** Forgets the stored credential of an account whose sign-in has ended. A browser has none to forget. */
export async function forgetCredential(account: string): Promise<void> {
  if (isNativeApp()) await deleteCredential(account);
}

/**
 * Puts a new sign-in's credential in the phone's secure storage, in the store app.
 *
 * Without it the sign-in would last only until the app is closed, so a
 * credential that cannot be kept ends the sign-in at once, on the API's side
 * too, rather than leaving a session nobody can reach.
 */
export async function keepNativeCredential(account: string, refresh: string | undefined): Promise<boolean> {
  try {
    if (!refresh) throw new Error("No credential came with the sign-in.");
    await putCredential(account, refresh);
    return true;
  } catch {
    if (refresh) await authPost("/user/auth/device/sign-out/", { account, refresh });
    return false;
  }
}
