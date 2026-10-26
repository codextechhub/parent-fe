import { parentRequest } from "@/auth/parent-fetch";
import { getAccount } from "@/auth/device-account";

import { APP_ID, installedVersion } from "./app-version";
import { deviceToken } from "./push-device";
import { nativePlatform } from "./platform";

const DEVICES = "/notify/push/devices/";

/** The school's answer to a phone being registered. `unavailable` is the school sending no phone push at all. */
export type RegisterResult = "ok" | "unavailable" | "failed";

/**
 * Tells the school this phone's Firebase token belongs to the signed-in parent.
 *
 * The body names the sign-in's device `account`, so the school ends the
 * phone's pushes when that sign-in ends. A 503 `PUSH_NOT_CONFIGURED` means the
 * school sends no phone push yet; that is `unavailable`, which the caller
 * treats as "not offered here" and never as an error to show.
 */
export async function registerDevice(token: string): Promise<RegisterResult> {
  let version = "";
  try {
    version = await installedVersion();
  } catch {
    version = "";
  }
  const account = (await getAccount()) ?? "";
  const answer = await parentRequest("POST", DEVICES, {
    token,
    platform: nativePlatform(),
    app: APP_ID,
    app_version: version,
    account,
  });
  if (answer.status === 201 || answer.status === 200) return "ok";
  if (answer.status === 503 && answer.code === "PUSH_NOT_CONFIGURED") return "unavailable";
  return "failed";
}

/** The longest a sign-out waits for the school to forget a phone. */
const FORGET_WAIT_MS = 3000;

/**
 * Asks the school to forget this phone, as far as it can in a moment.
 *
 * Signing out already removes the phone's rows on the school's side, so this
 * only makes the removal prompt and never blocks or fails a sign-out: no
 * token, no connection or a refusal all end quietly.
 */
export async function forgetDevice(): Promise<void> {
  const attempt = (async () => {
    const token = await deviceToken();
    await parentRequest("DELETE", DEVICES, { token });
  })().catch(() => undefined);
  await Promise.race([attempt, new Promise<void>((resolve) => setTimeout(resolve, FORGET_WAIT_MS))]);
}
