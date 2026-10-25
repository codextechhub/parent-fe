import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The device account of the parent signed in on this browser.
 *
 * A device sign-in answers an opaque `account` key; the API knows the session
 * by it, and the refresh credential itself is an HttpOnly cookie named for it
 * that the page cannot read. The key is the only thing kept here, so a reload
 * can ask for a fresh access token. No token is ever stored.
 *
 * A parent has one account per browser, so a single key is kept. The storage
 * sits behind `AccountStorage` so another host (a store app keeping the key in
 * the phone's secure storage) replaces it with `useAccountStorage` and nothing
 * else changes.
 *
 * Reads and writes go through an in-memory copy first, so a sign-in is seen by
 * the very next call whether or not the storage has finished writing.
 */
export type AccountStorage = {
  read(): Promise<string | null>;
  write(account: string): Promise<void>;
  remove(): Promise<void>;
};

const storageKey = () => `xvs.parent.account.${currentSchoolSlug() ?? ""}`;

/** The browser's storage, one key per school address. Unreadable storage reads as no account. */
const browserStorage: AccountStorage = {
  async read() {
    try {
      return localStorage.getItem(storageKey()) || null;
    } catch {
      return null;
    }
  },
  async write(account) {
    try {
      localStorage.setItem(storageKey(), account);
    } catch {
      // Not kept: the sign-in holds until the page closes, then asks again.
    }
  },
  async remove() {
    try {
      localStorage.removeItem(storageKey());
    } catch {
      // Nothing was kept.
    }
  },
};

let storage: AccountStorage = browserStorage;
let loaded = false;
let current: string | null = null;

/** Swaps where the key is kept. */
export function useAccountStorage(next: AccountStorage): void {
  storage = next;
  loaded = false;
  current = null;
}

/** The signed-in parent's device account, or null when nobody is signed in. */
export async function getAccount(): Promise<string | null> {
  if (loaded) return current;
  const stored = await storage.read();
  // A sign-in that landed while the read was out wins over the older stored key.
  if (!loaded) {
    current = stored;
    loaded = true;
  }
  return current;
}

/** Remembers the account a sign-in answered with. */
export async function setAccount(account: string): Promise<void> {
  current = account;
  loaded = true;
  await storage.write(account);
}

/** Forgets the account, as sign-out and an ended session do. */
export async function clearAccount(): Promise<void> {
  current = null;
  loaded = true;
  await storage.remove();
}

/** Test-only: forget the in-memory copy and the browser's stored key. */
export function _resetAccountForTests(): void {
  storage = browserStorage;
  loaded = false;
  current = null;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    // Nothing to clear.
  }
}
