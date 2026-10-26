import type { AccountStorage } from "@/auth/device-account";
import { currentSchoolSlug } from "@/utils/school-host";

/**
 * Where the store app keeps the parent's device account key.
 *
 * The key is not a secret (the credential behind it is, and lives in secure
 * storage, `native/credentials`). It is kept in the phone's preferences, which
 * the system removes with the app, one key per school code, so changing school
 * shows that school's sign-in and leaves the other's alone. Storage that
 * cannot be read reads as no account; one that cannot be written leaves the
 * sign-in holding until the app is closed.
 */
const keyFor = () => `xvs.parent.account.${currentSchoolSlug()}`;

export const nativeAccountStorage: AccountStorage = {
  async read() {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: keyFor() });
      return value || null;
    } catch {
      return null;
    }
  },
  async write(account) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: keyFor(), value: account });
    } catch {
      // Not kept: the sign-in holds until the app closes, then asks again.
    }
  },
  async remove() {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: keyFor() });
    } catch {
      // Nothing was kept.
    }
  },
};
