import type { SecureStoragePlugin } from "@aparajita/capacitor-secure-storage";

/**
 * The parent's device credential, in the phone's secure storage.
 *
 * The store app has no cookie jar to lean on. The API's refresh credential for
 * a parent's sign-in on this phone (`refresh`) is kept in the iOS Keychain or
 * the Android Keystore, keyed by the device account, and sent in the body of
 * the refresh and sign-out calls. It is never held in JavaScript longer than
 * a call needs, and never in the preferences, IndexedDB or localStorage that
 * the page can read. The 15-minute access token still lives in memory only.
 *
 * Items are kept `ThisDeviceOnly` and out of iCloud, so a backup restored on
 * another phone does not carry a sign-in with it.
 *
 * Reads and writes throw when the storage itself fails (a locked device), which
 * is different from the credential being absent (`null`): a caller must not
 * take a failed read for a sign-in that has ended.
 */

const PREFIX = "xvs.parent.";

/** The plugin in a wrapper: a plugin proxy must not be the value a promise resolves to. */
type Storage = { plugin: SecureStoragePlugin };

let ready: Promise<Storage> | null = null;

/** The plugin, set up once per launch: keys prefixed, no iCloud sync, this device only. */
function storage(): Promise<Storage> {
  ready ??= (async () => {
    const { SecureStorage, KeychainAccess } = await import("@aparajita/capacitor-secure-storage");
    await SecureStorage.setKeyPrefix(PREFIX);
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    return { plugin: SecureStorage };
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

const keyFor = (account: string) => `refresh.${account}`;

/** The credential kept for `account`, or null when there is none. */
export async function getCredential(account: string): Promise<string | null> {
  const value = await (await storage()).plugin.get(keyFor(account), false);
  return typeof value === "string" && value ? value : null;
}

/** Keeps `refresh` as `account`'s credential, replacing the one before it. */
export async function putCredential(account: string, refresh: string): Promise<void> {
  await (await storage()).plugin.set(keyFor(account), refresh, false);
}

/** Forgets `account`'s credential. Best effort: a credential that cannot be removed is already useless once the API has ended it. */
export async function deleteCredential(account: string): Promise<void> {
  try {
    await (await storage()).plugin.remove(keyFor(account));
  } catch {
    // Left behind; the API no longer honours it.
  }
}
